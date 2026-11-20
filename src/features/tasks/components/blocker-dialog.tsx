"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

/**
 * Moving a task to Blocked requires blocker details (Spec FR-06). Opened from the board drop,
 * the status menus and the detail header. The server re-validates and screens for secrets.
 */
export function BlockerDialog({
  open,
  taskTitle,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  taskTitle?: string
  pending?: boolean
  onConfirm: (details: string) => void
  onCancel: () => void
}) {
  const [details, setDetails] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDetails("")
          setError(null)
          onCancel()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            const value = details.trim()
            if (!value) {
              setError("Say what's blocking this task")
              return
            }
            setError(null)
            onConfirm(value)
            setDetails("")
          }}
        >
          <DialogHeader>
            <DialogTitle>What&apos;s blocking this task?</DialogTitle>
            <DialogDescription>
              {taskTitle ? (
                <>
                  Moving <span className="font-medium text-foreground">{taskTitle}</span> to
                  Blocked.{" "}
                </>
              ) : null}
              Note who or what you&apos;re waiting on, so it&apos;s clear what unblocks it.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="blocker-details">Blocker details</FieldLabel>
            <Textarea
              id="blocker-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
              rows={4}
              autoFocus
              aria-invalid={Boolean(error)}
              placeholder="Waiting for the client to send staging access"
            />
            <FieldDescription>Don&apos;t paste credentials or keys here.</FieldDescription>
            <FieldError errors={error ? [{ message: error }] : undefined} />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDetails("")
                setError(null)
                onCancel()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Mark blocked
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
