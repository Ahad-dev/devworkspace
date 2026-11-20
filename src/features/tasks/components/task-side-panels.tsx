"use client"

import * as React from "react"
import { Check, ExternalLink, Loader2, Plus, Tags, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LABEL_COLORS, LABEL_COLOR_META, type LabelColor } from "@/lib/constants/domain"
import { cn } from "@/lib/utils"
import { addLink, createLabel, removeLink, setTaskLabel } from "../actions"
import { LabelChip } from "./task-chips"
import { useInlineForm } from "./use-inline-form"

type Label = { id: string; name: string; color: LabelColor }

/* Labels --------------------------------------------------------------------- */

export function LabelsEditor({
  taskId,
  labels,
  allLabels,
  readOnly,
}: {
  taskId: string
  labels: Label[]
  allLabels: Label[]
  readOnly?: boolean
}) {
  const [selected, toggleOptimistic] = React.useOptimistic(
    new Set(labels.map((l) => l.id)),
    (state: Set<string>, change: { id: string; on: boolean }) => {
      const next = new Set(state)
      if (change.on) next.add(change.id)
      else next.delete(change.id)
      return next
    },
  )
  const [, startTransition] = React.useTransition()
  const { pending, formRef, onSubmit, error } = useInlineForm(createLabel.bind(null, taskId))
  const [color, setColor] = React.useState<LabelColor>("blue")

  const shown = allLabels.filter((l) => selected.has(l.id))

  function toggle(id: string, on: boolean) {
    startTransition(async () => {
      toggleOptimistic({ id, on })
      const r = await setTaskLabel({ taskId, labelId: id, on })
      if (!r.ok) toast.error(r.error)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.length ? (
          shown.map((l) => <LabelChip key={l.id} name={l.name} color={l.color} />)
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
      {!readOnly ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="xs" className="w-fit">
              <Tags />
              Edit labels
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            {allLabels.length ? (
              <ul className="flex max-h-56 flex-col overflow-y-auto" aria-label="Labels">
                {allLabels.map((l) => {
                  const on = selected.has(l.id)
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={on}
                        onClick={() => toggle(l.id, !on)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                      >
                        <span
                          className={cn("size-2.5 rounded-full", LABEL_COLOR_META[l.color].dot)}
                          aria-hidden
                        />
                        <span className="flex-1 truncate text-left">{l.name}</span>
                        {on ? <Check className="size-4" aria-hidden /> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No labels yet.</p>
            )}
            <form
              ref={formRef}
              onSubmit={onSubmit}
              className="mt-2 flex flex-col gap-1.5 border-t pt-2"
            >
              <p className="px-1 text-xs font-medium text-muted-foreground">New label</p>
              <div className="flex gap-1.5">
                <Input
                  name="name"
                  maxLength={50}
                  placeholder="e.g. bug"
                  aria-label="New label name"
                  className="h-7 text-sm"
                />
                <Select name="color" value={color} onValueChange={(v) => setColor(v as LabelColor)}>
                  <SelectTrigger size="sm" className="w-20" aria-label="Label colour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LABEL_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span
                          className={cn("size-2.5 rounded-full", LABEL_COLOR_META[c].dot)}
                          aria-hidden
                        />
                        <span className="capitalize">{c}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error("name") || error() ? (
                <p role="alert" className="px-1 text-xs text-destructive">
                  {error("name") ?? error()}
                </p>
              ) : null}
              <Button type="submit" size="xs" disabled={pending} className="w-fit">
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus />}
                Create and add
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}

/* Links ---------------------------------------------------------------------- */

function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
  // Stored URLs are http(s) only (http_url domain); open them without an opener reference.
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 items-center gap-1 text-sm underline-offset-4 hover:underline"
    >
      <span className="truncate">{children}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  )
}

export function LinksPanel({
  taskId,
  referenceUrl,
  links,
  readOnly,
}: {
  taskId: string
  referenceUrl: string | null
  links: { id: string; label: string; url: string }[]
  readOnly?: boolean
}) {
  const [adding, setAdding] = React.useState(false)
  const [removing, startRemove] = React.useTransition()
  const { pending, formRef, onSubmit, error } = useInlineForm(addLink.bind(null, taskId))

  return (
    <div className="flex flex-col gap-2">
      {referenceUrl || links.length ? (
        <ul className="flex flex-col gap-1.5">
          {referenceUrl ? (
            <li className="flex flex-col">
              <span className="text-xs text-muted-foreground">Reference</span>
              <SafeLink href={referenceUrl}>{referenceUrl.replace(/^https?:\/\//, "")}</SafeLink>
            </li>
          ) : null}
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-1">
              <SafeLink href={l.url}>{l.label}</SafeLink>
              {!readOnly ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label={`Remove link ${l.label}`}
                  disabled={removing}
                  onClick={() =>
                    startRemove(async () => {
                      const r = await removeLink({ taskId, linkId: l.id })
                      if (!r.ok) toast.error(r.error)
                    })
                  }
                >
                  <X />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No links.</p>
      )}

      {!readOnly && !adding ? (
        <Button variant="outline" size="xs" className="w-fit" onClick={() => setAdding(true)}>
          <Plus />
          Add link
        </Button>
      ) : null}
      {!readOnly && adding ? (
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-1.5">
          <Input
            name="label"
            maxLength={120}
            placeholder="Label, e.g. PR #42"
            aria-label="Link label"
            className="h-8"
            aria-invalid={Boolean(error("label"))}
          />
          {error("label") ? (
            <p role="alert" className="text-xs text-destructive">
              {error("label")}
            </p>
          ) : null}
          <Input
            name="url"
            type="url"
            maxLength={2048}
            placeholder="https://"
            aria-label="Link URL"
            className="h-8"
            aria-invalid={Boolean(error("url"))}
          />
          {error("url") || error() ? (
            <p role="alert" className="text-xs text-destructive">
              {error("url") ?? error()}
            </p>
          ) : null}
          <div className="flex gap-1.5">
            <Button type="submit" size="xs" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Add
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setAdding(false)}>
              Done
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
