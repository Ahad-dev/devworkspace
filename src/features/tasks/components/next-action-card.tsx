"use client"

import * as React from "react"
import { AlertTriangle, CornerDownRight, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import type { TaskStatus } from "@/lib/constants/domain"
import { cn } from "@/lib/utils"
import { saveNextAction } from "../actions"

/**
 * The prominent "Next action" card (Spec FR-06 "Next action" rule): the first concrete step on
 * resumption. A missing next action on an In Progress task is flagged, never blocked.
 */
export function NextActionCard({
  taskId,
  status,
  nextAction,
  readOnly = false,
}: {
  taskId: string
  status: TaskStatus
  nextAction: string | null
  readOnly?: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await saveNextAction(taskId, prev, formData)
      if (result.status === "success") {
        setEditing(false)
        toast.success("Next action saved")
      }
      return result
    },
    initialFormState,
  )
  const missing = status === "in_progress" && !nextAction
  const error =
    state.status === "error" ? (state.fieldErrors?.next_action?.[0] ?? state.message) : null

  return (
    <section
      aria-labelledby="next-action-heading"
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4",
        missing
          ? "border-status-in-progress/40 bg-status-in-progress/5"
          : "border-primary/25 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="next-action-heading"
          className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          <CornerDownRight className="size-3.5" aria-hidden />
          Next action
        </h2>
        {!editing && !readOnly ? (
          <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
            <Pencil />
            {nextAction ? "Edit" : "Add"}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => dispatch(data))
          }}
        >
          <label htmlFor="next-action-input" className="sr-only">
            Next action
          </label>
          <Textarea
            id="next-action-input"
            name="next_action"
            defaultValue={nextAction ?? ""}
            maxLength={1000}
            rows={2}
            autoFocus
            placeholder="Open the migration file and fix the FK on repositories"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "next-action-error" : undefined}
          />
          {error ? (
            <p id="next-action-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : nextAction ? (
        <p className="text-base leading-relaxed font-medium whitespace-pre-wrap">{nextAction}</p>
      ) : missing ? (
        <p className="flex items-start gap-1.5 text-sm text-status-in-progress">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          This task is in progress but has no next action. Note the first concrete step for when you
          pick it up again.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No next action yet. Add the first concrete step to take.
        </p>
      )}
    </section>
  )
}
