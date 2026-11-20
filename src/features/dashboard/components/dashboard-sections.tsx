import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  CircleSlash,
  CornerDownRight,
  Inbox,
  ListChecks,
  ServerCog,
  Timer,
  TriangleAlert,
} from "lucide-react"

import { PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import { buttonVariants } from "@/components/ui/button"
import { ProjectStatusBadge } from "@/features/projects/components/project-badges"
import { SessionControls } from "@/features/sessions/components/session-controls"
import { SessionTimer } from "@/features/sessions/components/session-timer"
import type { SessionView } from "@/features/sessions/queries"
import { isStale } from "@/features/sessions/utils"
import { DueDate } from "@/features/tasks/components/task-chips"
import { isOverdue, missingNextAction } from "@/features/tasks/utils"
import { formatRelative, taskProgress } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DashboardSummary, QueueTask } from "../queries"

/* Layout ----------------------------------------------------------------------- */

export function DashboardSection({
  title,
  id,
  action,
  children,
  className,
}: {
  title: string
  id: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  )
}

/* Current focus ---------------------------------------------------------------- */

/** The running session, or the most recent paused one with Resume (Spec FR-02 §1). */
export function FocusCard({
  session,
  renderedAt,
}: {
  session: SessionView | null
  renderedAt: number
}) {
  if (!session || !session.task) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Timer className="size-4" aria-hidden />
          No session running.
        </span>
        <span>Pick a task from the work queue and start working on it, or use Start session.</span>
      </div>
    )
  }
  const active = session.status === "active"
  const stale = active && isStale(session.openSegmentStartedAt, renderedAt)
  const task = session.task
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        active ? "border-status-in-progress/40 bg-status-in-progress/5" : "bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {active ? "Working on" : "Paused"}
          </span>
          <Link
            href={`/tasks/${task.id}`}
            className="text-base font-semibold break-words underline-offset-4 hover:underline"
          >
            {task.title}
          </Link>
          <span className="text-sm text-muted-foreground">
            <Link
              href={`/projects/${session.project.id}`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {session.project.name}
            </Link>
            {session.repository ? (
              <span className="font-mono"> · {session.repository.name}</span>
            ) : null}
            {session.branchName ? <span className="font-mono"> · {session.branchName}</span> : null}
          </span>
        </div>
        <SessionTimer
          closedSeconds={session.closedSeconds}
          openSegmentStartedAt={active ? session.openSegmentStartedAt : null}
          renderedAt={renderedAt}
          className="text-lg"
        />
      </div>
      {task.nextAction ? (
        <p className="flex items-start gap-1.5 text-sm">
          <CornerDownRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="text-muted-foreground">Next: </span>
            {task.nextAction}
          </span>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-status-in-progress">
          <AlertTriangle className="size-3.5" aria-hidden />
          No next action recorded.
        </p>
      )}
      {stale ? (
        <p className="text-sm text-status-blocked">
          Running for over 12 hours. Pause it and set when you actually stopped.
        </p>
      ) : null}
      <SessionControls
        taskId={task.id}
        taskTitle={task.title}
        taskNextAction={task.nextAction}
        current={{ id: session.id, status: session.status === "active" ? "active" : "paused" }}
        hasHistory
        activeElsewhere={null}
        stale={stale}
      />
    </div>
  )
}

/* Work queue and deadlines ----------------------------------------------------- */

export function TaskRows({
  tasks,
  timeZone,
  now,
  empty,
}: {
  tasks: QueueTask[]
  timeZone: string
  now: number
  empty: React.ReactNode
}) {
  if (!tasks.length) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }
  const at = new Date(now)
  return (
    <ul className="divide-y rounded-lg border">
      {tasks.map((t) => {
        const overdue = isOverdue(t, at)
        const missing = missingNextAction(t)
        return (
          <li key={t.id} className="flex flex-col gap-1 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <TaskStatusBadge status={t.status} />
              <Link
                href={`/tasks/${t.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
              >
                {t.title}
              </Link>
              <PriorityBadge priority={t.priority} className="hidden sm:inline-flex" />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {t.project ? <span className="truncate">{t.project.name}</span> : null}
              {t.due_at ? <DueDate dueAt={t.due_at} overdue={overdue} timeZone={timeZone} /> : null}
              {t.next_action ? (
                <span className="flex min-w-0 items-center gap-1">
                  <CornerDownRight className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{t.next_action}</span>
                </span>
              ) : missing ? (
                <span className="flex items-center gap-1 text-status-in-progress">
                  <AlertTriangle className="size-3" aria-hidden />
                  No next action
                </span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* Attention required ----------------------------------------------------------- */

export function AttentionTiles({ summary }: { summary: DashboardSummary }) {
  const tiles = [
    {
      label: "Overdue",
      count: summary.overdue,
      href: "/my-work?flags=overdue",
      icon: CalendarClock,
      tone: "text-destructive",
    },
    {
      label: "Blocked",
      count: summary.blocked,
      href: "/my-work?view=blocked",
      icon: CircleSlash,
      tone: "text-status-blocked",
    },
    {
      label: "No next action",
      count: summary.missing_next_action,
      href: "/my-work?flags=no-next-action",
      icon: TriangleAlert,
      tone: "text-status-in-progress",
    },
    {
      label: "Inbox to triage",
      count: summary.inbox,
      href: "/my-work?view=inbox",
      icon: Inbox,
      tone: "text-foreground",
    },
    {
      label: "Environments to review",
      count: summary.environments_needing_review,
      href: "/environments?view=review",
      icon: ServerCog,
      tone: "text-status-in-progress",
    },
  ]
  const clear = tiles.every((t) => t.count === 0)
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="flex h-full flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <t.icon className="size-3.5" aria-hidden />
                {t.label}
              </span>
              <span
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  t.count ? t.tone : "text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {clear ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ListChecks className="size-4" aria-hidden />
          Nothing needs attention.
        </p>
      ) : null}
    </div>
  )
}

/* Projects --------------------------------------------------------------------- */

type ProjectRow = {
  id: string | null
  name: string | null
  status: "active" | "on_hold" | "maintenance" | "completed" | "archived" | null
  updated_at: string | null
  task_count: number | null
  done_task_count: number | null
  open_task_count: number | null
}

export function ProjectProgressList({ projects, now }: { projects: ProjectRow[]; now: number }) {
  return (
    <ul className="divide-y rounded-lg border">
      {projects.map((p) => {
        if (!p.id || !p.name) return null
        const total = p.task_count ?? 0
        const done = p.done_task_count ?? 0
        const pct = taskProgress(done, total)
        return (
          <li key={p.id} className="flex flex-col gap-1.5 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/projects/${p.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
              >
                {p.name}
              </Link>
              {p.status && p.status !== "active" ? <ProjectStatusBadge status={p.status} /> : null}
            </div>
            {pct === null ? (
              <span className="text-xs text-muted-foreground">No tasks</span>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`${p.name} progress`}
                >
                  <div
                    className="h-full rounded-full bg-status-done"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {done}/{total} done
                </span>
              </div>
            )}
            {p.updated_at ? (
              <span className="text-xs text-muted-foreground">
                Updated {formatRelative(p.updated_at, new Date(now))}
                {p.open_task_count ? ` · ${p.open_task_count} open` : ""}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function FirstRun() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
      <h2 className="text-base font-semibold">Start with a project</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        Register a project you&apos;re working on, add its repositories, then capture tasks. The
        overview fills in as you work: your queue, what&apos;s overdue or blocked, deadlines and
        recent activity.
      </p>
      <Link href="/projects" className={buttonVariants({ size: "sm" })}>
        Go to projects
      </Link>
    </div>
  )
}
