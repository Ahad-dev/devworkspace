"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, CirclePause } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { isStale } from "../utils"
import { HandoffDialog } from "./handoff-dialog"
import { SessionTimer, useNow } from "./session-timer"

/** Refresh server data when the window regains focus (other devices may have changed it). */
function useRefreshOnFocus(minIntervalMs = 30_000) {
  const router = useRouter()
  React.useEffect(() => {
    let last = Date.now()
    const onFocus = () => {
      if (Date.now() - last < minIntervalMs) return
      last = Date.now()
      router.refresh()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [router, minIntervalMs])
}

/**
 * Header widget for the running session (Plan P4.4): task, live timer from the persisted segment
 * start, and Pause. Server-rendered on every page, so a refresh or another device shows the same.
 */
export function ActiveSessionWidget({
  session,
  renderedAt,
}: {
  session: {
    id: string
    closedSeconds: number
    openSegmentStartedAt: string | null
    task: { id: string; title: string; nextAction: string | null } | null
    projectName: string
  }
  renderedAt: number
}) {
  useRefreshOnFocus()
  const now = useNow(renderedAt)
  const stale = isStale(session.openSegmentStartedAt, now)
  const [pauseOpen, setPauseOpen] = React.useState(false)
  const [key, setKey] = React.useState(0)
  const title = session.task?.title ?? session.projectName

  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2 text-sm",
        stale ? "border-status-in-progress/50 bg-status-in-progress/10" : "bg-muted/40",
      )}
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-done opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-status-done" />
      </span>
      <span className="sr-only">Working on</span>
      {session.task ? (
        <Link
          href={`/tasks/${session.task.id}`}
          className="hidden max-w-44 truncate underline-offset-4 hover:underline md:inline"
          title={title}
        >
          {title}
        </Link>
      ) : null}
      <SessionTimer
        closedSeconds={session.closedSeconds}
        openSegmentStartedAt={session.openSegmentStartedAt}
        renderedAt={renderedAt}
        className="text-xs"
      />
      {stale ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/sessions" aria-label="Running for over 12 hours: review it">
              <AlertTriangle className="size-4 text-status-in-progress" aria-hidden />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Running for over 12 hours. Did you forget to pause?</TooltipContent>
        </Tooltip>
      ) : null}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Pause work on ${title}`}
        onClick={() => {
          setKey((k) => k + 1)
          setPauseOpen(true)
        }}
      >
        <CirclePause />
      </Button>
      {pauseOpen ? (
        <HandoffDialog
          key={key}
          open
          onOpenChange={setPauseOpen}
          mode="pause"
          sessionId={session.id}
          taskTitle={title}
          currentNextAction={session.task?.nextAction}
          allowEndTime={stale}
        />
      ) : null}
    </div>
  )
}
