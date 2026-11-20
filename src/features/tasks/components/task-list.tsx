import Link from "next/link"
import { ChevronLeft, ChevronRight, CircleSlash } from "lucide-react"

import { PriorityBadge } from "@/components/shared/domain-badges"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { TaskListRow } from "../queries"
import { DueDate, LabelChips, NextActionIndicator } from "./task-chips"
import { TaskStatusMenu } from "./task-status-menu"

/** Task table (Spec §6.5): title, project, status, priority, due, repository, next action, updated. */
export function TaskList({
  tasks,
  showProject,
  timeZone,
}: {
  tasks: TaskListRow[]
  showProject: boolean
  timeZone: string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">Task</TableHead>
            {showProject ? <TableHead className="hidden md:table-cell">Project</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Priority</TableHead>
            <TableHead className="hidden sm:table-cell">Due</TableHead>
            <TableHead className="hidden lg:table-cell">Repository</TableHead>
            <TableHead className="hidden xl:table-cell">Next action</TableHead>
            <TableHead className="hidden text-right md:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => (
            <TableRow key={t.id} className={cn(t.archived_at && "opacity-70")}>
              <TableCell>
                <div className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                  >
                    {t.title}
                  </Link>
                  {t.status === "blocked" && t.blocker_details ? (
                    <span className="inline-flex max-w-md items-start gap-1 text-xs text-status-blocked">
                      <CircleSlash className="mt-0.5 size-3 shrink-0" aria-hidden />
                      <span className="line-clamp-2">{t.blocker_details}</span>
                    </span>
                  ) : null}
                  <LabelChips labels={t.labels} />
                </div>
              </TableCell>
              {showProject ? (
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  <Link
                    href={`/projects/${t.project_id}/tasks`}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t.project?.name}
                  </Link>
                </TableCell>
              ) : null}
              <TableCell>
                <TaskStatusMenu taskId={t.id} taskTitle={t.title} status={t.status} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <PriorityBadge priority={t.priority} />
              </TableCell>
              <TableCell className="hidden text-sm sm:table-cell">
                <DueDate dueAt={t.due_at} overdue={t.overdue} timeZone={timeZone} />
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {t.repository?.name ?? "-"}
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <NextActionIndicator nextAction={t.next_action} missing={t.missingNextAction} />
              </TableCell>
              <TableCell className="hidden text-right whitespace-nowrap text-muted-foreground md:table-cell">
                {formatRelative(t.updated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Prev/next links that keep the current filters. */
export function TaskPagination({
  pathname,
  searchParams,
  page,
  pageSize,
  total,
}: {
  pathname: string
  searchParams: Record<string, string | string[] | undefined>
  page: number
  pageSize: number
  total: number
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const href = (p: number) => {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      const value = Array.isArray(v) ? v[0] : v
      if (value && k !== "page") next.set(k, value)
    }
    if (p > 1) next.set("page", String(p))
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <span className="tabular-nums">
        {from}–{to} of {total}
      </span>
      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous page">
            <ChevronLeft className="size-4" aria-hidden />
            Previous
          </PageLink>
          <span className="px-2 tabular-nums">
            {page} / {pages}
          </span>
          <PageLink href={href(page + 1)} disabled={page >= pages} label="Next page">
            Next
            <ChevronRight className="size-4" aria-hidden />
          </PageLink>
        </div>
      ) : null}
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const cls =
    "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[0.8rem] font-medium"
  if (disabled) {
    return (
      <span aria-disabled className={cn(cls, "pointer-events-none opacity-50")}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} aria-label={label} className={cn(cls, "text-foreground hover:bg-muted")}>
      {children}
    </Link>
  )
}
