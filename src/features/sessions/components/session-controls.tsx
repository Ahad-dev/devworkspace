"use client"

import * as React from "react"
import { CirclePause, Flag, Loader2, NotebookPen, Play, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { resumeSession, startSession, type SessionResult } from "../actions"
import { HandoffDialog, type HandoffMode } from "./handoff-dialog"
import { SwitchSessionDialog } from "./switch-session-dialog"
import { offlineResult, whenOnline } from "@/lib/offline/guard"

type Current = { id: string; status: "active" | "paused" | "completed" }

/**
 * Start / pause / resume / finish / save progress for one task (Plan P4.5). The buttons reflect
 * the task's own session; a session running on another task triggers the switch dialog.
 */
export function SessionControls({
  taskId,
  taskTitle,
  taskNextAction,
  current,
  hasHistory,
  activeElsewhere,
  stale = false,
  size = "sm",
}: {
  taskId: string
  taskTitle: string
  taskNextAction: string | null
  current: Current | null
  hasHistory: boolean
  activeElsewhere: { id: string; taskTitle: string | null } | null
  stale?: boolean
  size?: "sm" | "xs"
}) {
  const [pending, startTransition] = React.useTransition()
  const [dialog, setDialog] = React.useState<HandoffMode | null>(null)
  const [dialogKey, setDialogKey] = React.useState(0)
  const [switchTo, setSwitchTo] = React.useState<{
    activeSessionId: string
    next: { taskId: string } | { resumeSessionId: string }
  } | null>(null)

  function open(mode: HandoffMode) {
    setDialogKey((k) => k + 1)
    setDialog(mode)
  }

  function handle(
    r: SessionResult,
    next: { taskId: string } | { resumeSessionId: string },
    ok: string,
  ) {
    if (r.ok) toast.success(ok)
    else if (r.activeSessionId) setSwitchTo({ activeSessionId: r.activeSessionId, next })
    else toast.error(r.error)
  }

  function start() {
    if (activeElsewhere) {
      setSwitchTo({ activeSessionId: activeElsewhere.id, next: { taskId } })
      return
    }
    startTransition(async () =>
      handle(
        await whenOnline(() => startSession({ taskId }), offlineResult),
        { taskId },
        "Session started",
      ),
    )
  }

  function resume(sessionId: string) {
    if (activeElsewhere) {
      setSwitchTo({ activeSessionId: activeElsewhere.id, next: { resumeSessionId: sessionId } })
      return
    }
    startTransition(async () =>
      handle(
        await whenOnline(() => resumeSession({ sessionId }), offlineResult),
        { resumeSessionId: sessionId },
        "Session resumed",
      ),
    )
  }

  const spinner = pending ? <Loader2 className="animate-spin" aria-hidden /> : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {current?.status === "active" ? (
        <>
          <Button size={size} onClick={() => open("pause")}>
            <CirclePause />
            Pause
          </Button>
          <Button size={size} variant="outline" onClick={() => open("save")}>
            <NotebookPen />
            Save progress
          </Button>
          <Button size={size} variant="outline" onClick={() => open("complete")}>
            <Flag />
            Finish
          </Button>
        </>
      ) : current?.status === "paused" ? (
        <>
          <Button size={size} disabled={pending} onClick={() => resume(current.id)}>
            {spinner ?? <Play />}
            Resume
          </Button>
          <Button size={size} variant="outline" onClick={() => open("complete")}>
            <Flag />
            Finish
          </Button>
        </>
      ) : (
        <Button size={size} disabled={pending} onClick={start}>
          {spinner ?? (hasHistory ? <RotateCcw /> : <Play />)}
          {hasHistory ? "Resume work" : "Start work"}
        </Button>
      )}

      {current && dialog ? (
        <HandoffDialog
          key={dialogKey}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          mode={dialog}
          sessionId={current.id}
          taskTitle={taskTitle}
          currentNextAction={taskNextAction}
          allowEndTime={stale}
        />
      ) : null}

      {switchTo ? (
        <SwitchSessionDialog
          open
          onOpenChange={(o) => !o && setSwitchTo(null)}
          activeSessionId={switchTo.activeSessionId}
          activeTaskTitle={activeElsewhere?.taskTitle}
          next={switchTo.next}
        />
      ) : null}
    </div>
  )
}
