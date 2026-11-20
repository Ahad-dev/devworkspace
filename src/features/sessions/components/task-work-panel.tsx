import { GitBranch, History, Timer } from "lucide-react"

import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { getTaskContinuity, SessionView } from "../queries"
import { elapsedSeconds, formatDuration, isStale } from "../utils"
import { HandoffCard } from "./handoff-card"
import { SessionControls } from "./session-controls"
import { SessionDetailsForm } from "./session-details-form"
import { SessionTimer } from "./session-timer"

type Continuity = Awaited<ReturnType<typeof getTaskContinuity>>

/**
 * Work on this task (Spec §6.7–6.8; Plan P4.5, P4.7): controls, the current session with its live
 * timer, and the latest handoff first (Spec §5.5).
 */
export function TaskWorkPanel({
  task,
  continuity,
  active,
  repositories,
  renderedAt,
  timeZone,
}: {
  task: { id: string; title: string; nextAction: string | null; archived: boolean }
  continuity: Continuity
  /** The user's running session, wherever it is. */
  active: SessionView | null
  repositories: { id: string; name: string }[]
  renderedAt: number
  timeZone: string
}) {
  const current = continuity.current
  const latest = continuity.handoffs[0]
  const activeElsewhere =
    active && active.id !== current?.id
      ? { id: active.id, taskTitle: active.task?.title ?? null }
      : null
  const stale = current?.status === "active" && isStale(current.openSegmentStartedAt, renderedAt)

  return (
    <section aria-labelledby="work-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="work-heading" className="flex items-center gap-1.5 text-base font-semibold">
          <Timer className="size-4 text-muted-foreground" aria-hidden />
          Work
        </h2>
        {!task.archived ? (
          <SessionControls
            taskId={task.id}
            taskTitle={task.title}
            taskNextAction={task.nextAction}
            current={current ? { id: current.id, status: current.status } : null}
            hasHistory={continuity.sessions.length > 0}
            activeElsewhere={activeElsewhere}
            stale={stale}
          />
        ) : null}
      </div>

      {current ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
            current.status === "active"
              ? stale
                ? "border-status-in-progress/50 bg-status-in-progress/5"
                : "border-status-done/40 bg-status-done/5"
              : "bg-muted/30",
          )}
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">
              {current.status === "active" ? "Working now" : "Paused"}
              {stale ? (
                <span className="ml-2 text-xs font-normal text-status-in-progress">
                  running for over 12 hours: pause it at the time you stopped
                </span>
              ) : null}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>Started {formatDateTime(current.startedAt, timeZone)}</span>
              {current.repository ? <span>· {current.repository.name}</span> : null}
              {current.branchName ? (
                <span className="inline-flex items-center gap-1 font-mono">
                  · <GitBranch className="size-3" aria-hidden />
                  {current.branchName}
                </span>
              ) : null}
            </p>
            {current.notes ? (
              <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
                {current.notes}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {current.status === "active" ? (
              <SessionTimer
                closedSeconds={current.closedSeconds}
                openSegmentStartedAt={current.openSegmentStartedAt}
                renderedAt={renderedAt}
                className="text-lg font-medium"
              />
            ) : (
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatDuration(current.closedSeconds)} worked
              </span>
            )}
            <SessionDetailsForm
              sessionId={current.id}
              branchName={current.branchName}
              notes={current.notes}
              repositoryId={current.repositoryId}
              repositories={repositories}
            />
          </div>
        </div>
      ) : null}

      {latest ? (
        <HandoffCard handoff={latest} timeZone={timeZone} latest />
      ) : !current ? (
        <p className="text-sm text-muted-foreground">
          No sessions yet. Start work to track time and leave a handoff for next time.
        </p>
      ) : null}
    </section>
  )
}

/** Older handoffs and every session on this task (Spec FR-07: history stays intact). */
export function TaskSessionHistory({
  continuity,
  renderedAt,
  timeZone,
}: {
  continuity: Continuity
  renderedAt: number
  timeZone: string
}) {
  const { sessions, handoffs } = continuity
  if (sessions.length === 0) return null
  const older = handoffs.slice(1)

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-3">
      <h2 id="history-heading" className="flex items-center gap-1.5 text-base font-semibold">
        <History className="size-4 text-muted-foreground" aria-hidden />
        Session history
      </h2>
      <ul className="flex flex-col divide-y rounded-lg border">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span className="flex flex-col">
              <span>{formatDateTime(s.startedAt, timeZone)}</span>
              {s.branchName ? (
                <span className="font-mono text-xs text-muted-foreground">{s.branchName}</span>
              ) : null}
            </span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="capitalize">{s.status}</span>
              <span className="tabular-nums">
                {formatDuration(
                  elapsedSeconds(s.closedSeconds, s.openSegmentStartedAt, renderedAt),
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {older.length ? (
        <details className="group flex flex-col gap-3">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {older.length} earlier handoff{older.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {older.map((h) => (
              <HandoffCard key={h.id} handoff={h} timeZone={timeZone} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}
