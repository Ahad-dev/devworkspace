"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormMessage } from "@/features/auth/components/form-message"
import {
  completeSession,
  pauseSession,
  saveHandoff,
  type HandoffPayload,
  type SessionResult,
} from "../actions"
import { offlineResult, whenOnline } from "@/lib/offline/guard"

export type HandoffMode = "pause" | "complete" | "save"

const COPY: Record<HandoffMode, { title: string; submit: string; done: string; blurb: string }> = {
  pause: {
    title: "Pause and hand off",
    submit: "Pause session",
    done: "Session paused",
    blurb: "Note the next step so you can pick this up again.",
  },
  complete: {
    title: "Finish session",
    submit: "Finish session",
    done: "Session finished",
    blurb: "Note what comes next, if anything.",
  },
  save: {
    title: "Save progress",
    submit: "Save handoff",
    done: "Handoff saved",
    blurb: "Snapshot where things stand without stopping the timer.",
  },
}

const EMPTY: HandoffPayload = {
  completed_summary: "",
  current_state: "",
  remaining_work: "",
  next_action: "",
  blockers: "",
  technical_notes: "",
  related_links: [],
}

/**
 * Handoff form (Spec FR-07, §5.4), opened on pause, finish and "Save progress". Saving creates an
 * immutable snapshot; "Update the task's next action" copies it to the task (on by default).
 * `allowEndTime` adds "Stopped working at" for sessions left running (Plan P4.7).
 *
 * Pause and Finish are quick (Plan P10.3): the next action and one checkbox, with the full set of
 * notes behind "Add more notes". The values live in state, so hiding the notes never loses them.
 */
export function HandoffDialog({
  open,
  onOpenChange,
  mode,
  sessionId,
  taskTitle,
  currentNextAction,
  allowEndTime = false,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: HandoffMode
  sessionId: string
  taskTitle: string
  currentNextAction?: string | null
  allowEndTime?: boolean
  onDone?: () => void
}) {
  const [values, setValues] = React.useState<HandoffPayload>({
    ...EMPTY,
    next_action: currentNextAction ?? "",
  })
  const [updateTask, setUpdateTask] = React.useState(true)
  const [endedAt, setEndedAt] = React.useState("")
  const [result, setResult] = React.useState<SessionResult | null>(null)
  // "Save progress" is the full snapshot; Pause and Finish start short.
  const [showNotes, setShowNotes] = React.useState(mode === "save")
  const [pending, startTransition] = React.useTransition()
  const copy = COPY[mode]

  const err = (key: string) =>
    result && !result.ok ? result.fieldErrors?.[key]?.map((message) => ({ message })) : undefined
  const set = (key: keyof Omit<HandoffPayload, "related_links">) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const links = values.related_links.filter((l) => l.label.trim() || l.url.trim())
      const handoff = { ...values, related_links: links }
      // datetime-local is the browser's local time; send an ISO instant.
      const end = endedAt ? new Date(endedAt).toISOString() : null
      const r = await whenOnline(
        () =>
          mode === "save"
            ? saveHandoff({ sessionId, handoff, updateTaskNextAction: updateTask })
            : (mode === "pause" ? pauseSession : completeSession)({
                sessionId,
                handoff,
                endedAt: end,
                updateTaskNextAction: updateTask,
              }),
        offlineResult,
      )
      setResult(r)
      // An error on one of the extra notes must be visible to be fixed.
      if (
        !r.ok &&
        Object.keys(r.fieldErrors ?? {}).some((k) => k !== "next_action" && k !== "form")
      ) {
        setShowNotes(true)
      }
      if (r.ok) {
        toast.success(copy.done)
        onOpenChange(false)
        onDone?.()
      }
    })
  }

  const missingNext = !values.next_action.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{taskTitle}</span>. {copy.blurb}
            </DialogDescription>
          </DialogHeader>

          {result && !result.ok ? <FormMessage status="error">{result.error}</FormMessage> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(err("next_action"))}>
              <FieldLabel htmlFor="handoff-next">Next action</FieldLabel>
              <Input
                id="handoff-next"
                value={values.next_action}
                onChange={(e) => set("next_action")(e.target.value)}
                maxLength={1000}
                autoFocus
                placeholder="The first concrete step when you resume"
              />
              {missingNext ? (
                <FieldDescription className="flex items-center gap-1 text-status-in-progress">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  No next action: that&apos;s allowed, but the task will show it as missing.
                </FieldDescription>
              ) : null}
              <FieldError errors={err("next_action")} />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="handoff-update-task"
                checked={updateTask}
                onCheckedChange={(v) => setUpdateTask(v === true)}
              />
              <Label htmlFor="handoff-update-task" className="font-normal">
                Update the task&apos;s next action
              </Label>
            </div>

            {showNotes ? (
              <>
                <TextField
                  id="handoff-completed"
                  label="Completed"
                  placeholder="What got done in this session"
                  value={values.completed_summary}
                  onChange={set("completed_summary")}
                  max={10000}
                  errors={err("completed_summary")}
                />
                <TextField
                  id="handoff-state"
                  label="Current state"
                  placeholder="What works now, what's mid-change"
                  value={values.current_state}
                  onChange={set("current_state")}
                  max={10000}
                  errors={err("current_state")}
                />
                <TextField
                  id="handoff-remaining"
                  label="Remaining"
                  placeholder="What isn't finished yet"
                  value={values.remaining_work}
                  onChange={set("remaining_work")}
                  max={10000}
                  errors={err("remaining_work")}
                />
                <TextField
                  id="handoff-blockers"
                  label="Blockers"
                  placeholder="Anything stopping progress"
                  value={values.blockers}
                  onChange={set("blockers")}
                  max={2000}
                  errors={err("blockers")}
                />
                <TextField
                  id="handoff-notes"
                  label="Technical notes"
                  placeholder="Findings, commands, files, behaviour worth remembering"
                  value={values.technical_notes}
                  onChange={set("technical_notes")}
                  max={20000}
                  errors={err("technical_notes")}
                  description="Reference where secrets live; never paste their values."
                />

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">Related links</legend>
                  {values.related_links.map((link, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        <Input
                          aria-label={`Link ${i + 1} label`}
                          placeholder="PR #42"
                          value={link.label}
                          maxLength={120}
                          className="w-36 shrink-0"
                          aria-invalid={Boolean(err(`related_links.${i}.label`))}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              related_links: v.related_links.map((l, j) =>
                                j === i ? { ...l, label: e.target.value } : l,
                              ),
                            }))
                          }
                        />
                        <Input
                          aria-label={`Link ${i + 1} URL`}
                          placeholder="https://"
                          type="url"
                          value={link.url}
                          maxLength={2048}
                          aria-invalid={Boolean(err(`related_links.${i}.url`))}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              related_links: v.related_links.map((l, j) =>
                                j === i ? { ...l, url: e.target.value } : l,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove link ${i + 1}`}
                          onClick={() =>
                            setValues((v) => ({
                              ...v,
                              related_links: v.related_links.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          <X />
                        </Button>
                      </div>
                      <FieldError
                        errors={[
                          ...(err(`related_links.${i}.label`) ?? []),
                          ...(err(`related_links.${i}.url`) ?? []),
                        ]}
                      />
                    </div>
                  ))}
                  {values.related_links.length < 20 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="w-fit"
                      onClick={() =>
                        setValues((v) => ({
                          ...v,
                          related_links: [...v.related_links, { label: "", url: "" }],
                        }))
                      }
                    >
                      <Plus />
                      Add link
                    </Button>
                  ) : null}
                </fieldset>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setShowNotes(true)}
              >
                <Plus />
                Add more notes
              </Button>
            )}

            {allowEndTime && mode !== "save" ? (
              <Field data-invalid={Boolean(err("form"))}>
                <FieldLabel htmlFor="handoff-ended-at">Stopped working at</FieldLabel>
                <Input
                  id="handoff-ended-at"
                  type="datetime-local"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                />
                <FieldDescription>
                  Leave empty to use now. Set it if you stopped earlier and left the timer running.
                </FieldDescription>
                <FieldError errors={err("form")} />
              </Field>
            ) : null}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TextField({
  id,
  label,
  placeholder,
  value,
  onChange,
  max,
  errors,
  description,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  max: number
  errors?: { message: string }[]
  description?: string
}) {
  return (
    <Field data-invalid={Boolean(errors?.length)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
        rows={2}
        placeholder={placeholder}
        aria-invalid={Boolean(errors?.length)}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={errors} />
    </Field>
  )
}
