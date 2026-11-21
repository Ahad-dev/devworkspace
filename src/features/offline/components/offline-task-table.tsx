import { CircleSlash } from "lucide-react"

import { PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DueDate, LabelChips, NextActionIndicator } from "@/features/tasks/components/task-chips"
import { isOverdue, missingNextAction } from "@/features/tasks/utils"
import type { OfflineTask } from "../snapshot"

/**
 * Read-only task table for the offline copy (Plan P9.4): the live list's columns without the
 * status menu. Plain links, so each one is a real page load that the service worker answers.
 */
export function OfflineTaskTable({
  tasks,
  showProject,
  timeZone,
  now,
}: {
  tasks: OfflineTask[]
  showProject: boolean
  timeZone: string
  now: Date
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
            <TableHead className="hidden lg:table-cell">Next action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <div className="flex min-w-0 flex-col gap-1">
                  <a
                    href={`/tasks/${t.id}`}
                    className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                  >
                    {t.title}
                  </a>
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
                  <a
                    href={`/projects/${t.project_id}/tasks`}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t.project?.name}
                  </a>
                </TableCell>
              ) : null}
              <TableCell>
                <TaskStatusBadge status={t.status} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <PriorityBadge priority={t.priority} />
              </TableCell>
              <TableCell className="hidden text-sm sm:table-cell">
                <DueDate dueAt={t.due_at} overdue={isOverdue(t, now)} timeZone={timeZone} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <NextActionIndicator nextAction={t.next_action} missing={missingNextAction(t)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
