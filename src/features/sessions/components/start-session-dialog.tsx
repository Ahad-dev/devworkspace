"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Play } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TASK_STATUS_META, type TaskStatus } from "@/lib/constants/domain"
import { startSession } from "../actions"
import { SwitchSessionDialog } from "./switch-session-dialog"

type StartableTask = { id: string; title: string; status: string; projectName: string }

/**
 * Quick-create a work session (Plan P7.3; Spec FR-07: a session is on a task). A session already
 * running elsewhere opens the pause-or-finish choice instead of overlapping timers.
 */
export function StartSessionDialog({
  tasks,
  open,
  onOpenChange,
}: {
  tasks: StartableTask[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [taskId, setTaskId] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const [conflict, setConflict] = React.useState<string | null>(null)

  function start() {
    if (!taskId) return
    startTransition(async () => {
      const r = await startSession({ taskId })
      if (r.ok) {
        toast.success("Session started")
        onOpenChange(false)
        router.push(`/tasks/${taskId}`)
      } else if (r.activeSessionId) {
        setConflict(r.activeSessionId)
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <>
      <Dialog open={open && !conflict} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start a work session</DialogTitle>
            <DialogDescription>
              Pick the task you&apos;re working on. The timer runs until you pause or finish.
            </DialogDescription>
          </DialogHeader>
          {tasks.length ? (
            <Field>
              <FieldLabel htmlFor="start-session-task">Task</FieldLabel>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger id="start-session-task" className="w-full">
                  <SelectValue placeholder="Choose a task…" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="truncate">
                        {t.title}
                        <span className="text-muted-foreground">
                          {" "}
                          · {t.projectName} ·{" "}
                          {TASK_STATUS_META[t.status as TaskStatus]?.label ?? t.status}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Inbox, Ready and Review tasks move to In Progress.
              </FieldDescription>
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">
              No open tasks yet. Create a task first, then start working on it.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!taskId || pending} onClick={start}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Play />}
              Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {conflict ? (
        <SwitchSessionDialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setConflict(null)
              onOpenChange(false)
            }
          }}
          activeSessionId={conflict}
          next={{ taskId }}
        />
      ) : null}
    </>
  )
}
