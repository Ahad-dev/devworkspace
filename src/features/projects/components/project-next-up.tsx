import Link from "next/link"
import { ArrowRight, CircleCheck, Circle } from "lucide-react"

import { PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import { NextActionIndicator } from "@/features/tasks/components/task-chips"
import { QuickTaskDialog } from "@/features/tasks/components/quick-task-dialog"
import { listNextUp } from "@/features/tasks/queries"
import { cn } from "@/lib/utils"

/**
 * The top of a project's Overview (Plan P10.6): what to work on next, and, while the project is
 * still being set up, the three things that make the rest of the app useful.
 */
export async function ProjectNextUp({
  project,
  counts,
  canEdit,
}: {
  project: { id: string; name: string }
  counts: { tasks: number; repositories: number; environments: number }
  canEdit: boolean
}) {
  const tasks = await listNextUp(project.id)
  const steps = [
    {
      done: counts.tasks > 0,
      label: "Add a first task",
      href: `/projects/${project.id}/tasks`,
    },
    {
      done: counts.repositories > 0,
      label: "Add the code repository",
      href: `/projects/${project.id}/repositories`,
    },
    {
      done: counts.environments > 0,
      label: "Add where it runs (an environment)",
      href: `/projects/${project.id}/environments`,
    },
  ]
  const setupLeft = canEdit && steps.some((s) => !s.done)

  return (
    <>
      {setupLeft ? (
        <section
          aria-labelledby="setup-heading"
          className="flex flex-col gap-3 rounded-lg border border-dashed p-4"
        >
          <h2 id="setup-heading" className="text-base font-semibold">
            Get this project set up
          </h2>
          <ol className="flex flex-col gap-2 text-sm">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                {s.done ? (
                  <CircleCheck className="size-4 text-status-done" aria-hidden />
                ) : (
                  <Circle className="size-4 text-muted-foreground" aria-hidden />
                )}
                {s.done ? (
                  <span className="text-muted-foreground line-through">
                    {s.label}
                    <span className="sr-only"> (done)</span>
                  </span>
                ) : (
                  <Link href={s.href} className="underline-offset-4 hover:underline">
                    {s.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="next-up-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="next-up-heading" className="text-base font-semibold">
            Next up
          </h2>
          <div className="flex items-center gap-2">
            {canEdit ? (
              <QuickTaskDialog
                fixedProject={{ id: project.id, name: project.name }}
                triggerLabel="Add task"
              />
            ) : null}
            <Link
              href={`/projects/${project.id}/tasks`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              All tasks
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing in progress or ready. Add a task, or move one to Ready on the board.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {tasks.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-3",
                )}
              >
                <Link
                  href={`/tasks/${t.id}`}
                  className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
                >
                  {t.title}
                </Link>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <NextActionIndicator nextAction={t.next_action} missing={t.missingNextAction} />
                  <TaskStatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
