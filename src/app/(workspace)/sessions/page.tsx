import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { AlertTriangle, GitBranch, Timer } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMyProfile } from "@/features/profile/queries"
import { SessionControls } from "@/features/sessions/components/session-controls"
import { SessionTimer } from "@/features/sessions/components/session-timer"
import {
  getActiveSession,
  listSessions,
  SESSIONS_PAGE_SIZE,
  type SessionView,
} from "@/features/sessions/queries"
import { formatDuration, isStale } from "@/features/sessions/utils"
import { TaskPagination } from "@/features/tasks/components/task-list"
import { formatDateTime } from "@/lib/format"
import { requestTime } from "@/lib/request-time"

export const metadata: Metadata = { title: "Work Sessions" }

/** Running, paused and finished sessions (Spec FR-07; Plan P4.7). */
export default function SessionsPage({ searchParams }: PageProps<"/sessions">) {
  return (
    <PageContainer>
      <PageHeader
        title="Work Sessions"
        description="Focused work periods and the handoffs you saved."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Sessions searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

function TaskCell({ s }: { s: SessionView }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {s.task ? (
        <Link
          href={`/tasks/${s.task.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {s.task.title}
        </Link>
      ) : (
        <span className="text-muted-foreground">Task deleted</span>
      )}
      <span className="text-xs text-muted-foreground">
        {s.project.name}
        {s.branchName ? (
          <span className="ml-2 inline-flex items-center gap-1 font-mono">
            <GitBranch className="size-3" aria-hidden />
            {s.branchName}
          </span>
        ) : null}
      </span>
    </div>
  )
}

async function Sessions({
  searchParams,
}: {
  searchParams: PageProps<"/sessions">["searchParams"]
}) {
  const sp = await searchParams
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1)
  const [active, paused, history, profile, renderedAt] = await Promise.all([
    getActiveSession(),
    listSessions("paused"),
    listSessions("completed", page),
    getMyProfile(),
    requestTime(),
  ])
  const tz = profile.timezone
  const stale = active ? isStale(active.openSegmentStartedAt, renderedAt) : false
  const activeElsewhere = active ? { id: active.id, taskTitle: active.task?.title ?? null } : null

  if (!active && paused.total === 0 && history.total === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Timer />
          </EmptyMedia>
          <EmptyTitle>No work sessions yet</EmptyTitle>
          <EmptyDescription>
            Open a task and choose Start work. Pause or finish with a handoff so you can pick up
            where you left off.{" "}
            <Link href="/my-work" className="underline underline-offset-4">
              Go to My Work
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="running-heading" className="flex flex-col gap-3">
        <h2 id="running-heading" className="text-base font-semibold">
          Running
        </h2>
        {stale && active ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-status-in-progress/40 bg-status-in-progress/5 px-3 py-2 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-in-progress" aria-hidden />
            <span>
              This session has been running for over 12 hours. If you stopped earlier, pause it and
              set the time you actually stopped. Nothing is stopped automatically.
            </span>
          </p>
        ) : null}
        {active ? (
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <TaskCell s={active} />
            <div className="flex flex-wrap items-center gap-3">
              <SessionTimer
                closedSeconds={active.closedSeconds}
                openSegmentStartedAt={active.openSegmentStartedAt}
                renderedAt={renderedAt}
                className="text-lg font-medium"
              />
              {active.task ? (
                <SessionControls
                  taskId={active.task.id}
                  taskTitle={active.task.title}
                  taskNextAction={active.task.nextAction}
                  current={{ id: active.id, status: "active" }}
                  hasHistory
                  activeElsewhere={null}
                  stale={stale}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing is running.</p>
        )}
      </section>

      {paused.total > 0 ? (
        <section aria-labelledby="paused-heading" className="flex flex-col gap-3">
          <h2 id="paused-heading" className="text-base font-semibold">
            Paused <span className="text-sm font-normal text-muted-foreground">{paused.total}</span>
          </h2>
          <ul className="flex flex-col divide-y rounded-lg border">
            {paused.sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <TaskCell s={s} />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatDuration(s.closedSeconds)} worked
                  </span>
                  {s.task ? (
                    <SessionControls
                      taskId={s.task.id}
                      taskTitle={s.task.title}
                      taskNextAction={s.task.nextAction}
                      current={{ id: s.id, status: "paused" }}
                      hasHistory
                      activeElsewhere={activeElsewhere}
                      size="xs"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-base font-semibold">
          History
        </h2>
        {history.total === 0 ? (
          <p className="text-sm text-muted-foreground">No finished sessions yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-56">Task</TableHead>
                    <TableHead className="hidden sm:table-cell">Started</TableHead>
                    <TableHead className="hidden md:table-cell">Finished</TableHead>
                    <TableHead className="text-right">Worked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <TaskCell s={s} />
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                        {formatDateTime(s.startedAt, tz)}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {formatDateTime(s.endedAt, tz)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDuration(s.closedSeconds)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TaskPagination
              pathname="/sessions"
              searchParams={sp}
              page={page}
              pageSize={SESSIONS_PAGE_SIZE}
              total={history.total}
            />
          </>
        )}
      </section>
    </div>
  )
}
