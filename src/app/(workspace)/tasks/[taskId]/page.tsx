import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Archive, ChevronLeft, CircleSlash, History } from "lucide-react"

import { PageContainer } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/profile/queries"
import { ActivityList } from "@/features/projects/components/activity-list"
import { NextActionCard } from "@/features/tasks/components/next-action-card"
import { TaskActions } from "@/features/tasks/components/task-actions"
import { DueDate } from "@/features/tasks/components/task-chips"
import {
  CommentsPanel,
  DependenciesPanel,
  SubtasksPanel,
} from "@/features/tasks/components/task-relations"
import { LabelsEditor, LinksPanel } from "@/features/tasks/components/task-side-panels"
import { TaskPriorityMenu, TaskStatusMenu } from "@/features/tasks/components/task-status-menu"
import { getTask, getTaskRelations, listLabels, listTaskOptions } from "@/features/tasks/queries"
import { isOverdue } from "@/features/tasks/utils"
import { formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Task" }

/** Task detail (Spec FR-06, §6.7; Plan P3.10). */
export default function TaskPage({ params }: PageProps<"/tasks/[taskId]">) {
  return (
    <PageContainer className="gap-5">
      <Suspense fallback={<Skeleton className="h-[36rem] w-full" />}>
        {params.then(({ taskId }) => (
          <TaskDetail taskId={taskId} />
        ))}
      </Suspense>
    </PageContainer>
  )
}

function Section({
  title,
  children,
  id,
}: {
  title: string
  children: React.ReactNode
  id: string
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

async function TaskDetail({ taskId }: { taskId: string }) {
  const task = await getTask(taskId)
  const [rel, allLabels, options, profile] = await Promise.all([
    getTaskRelations(task),
    listLabels(),
    listTaskOptions(task.project_id, task.id),
    getMyProfile(),
  ])
  const tz = profile.timezone
  const archived = Boolean(task.archived_at)

  return (
    <>
      <Link
        href={`/projects/${task.project.id}/tasks`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {task.project.name} tasks
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight break-words">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <TaskStatusMenu taskId={task.id} taskTitle={task.title} status={task.status} />
            <TaskPriorityMenu taskId={task.id} priority={task.priority} />
            <span aria-hidden>·</span>
            <Link
              href={`/projects/${task.project.id}`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {task.project.name}
            </Link>
            {rel.parent ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  Subtask of{" "}
                  <Link
                    href={`/tasks/${rel.parent.id}`}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {rel.parent.title}
                  </Link>
                </span>
              </>
            ) : null}
          </div>
        </div>
        <TaskActions
          taskId={task.id}
          taskTitle={task.title}
          archived={archived}
          subtaskCount={rel.subtasks.length}
        />
      </header>

      {archived ? (
        <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Archive className="size-4" aria-hidden />
          Archived {formatDateTime(task.archived_at, tz)}. Restore it to edit or work on it.
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <NextActionCard
            taskId={task.id}
            status={task.status}
            nextAction={task.next_action}
            readOnly={archived}
          />

          {task.status === "blocked" ? (
            <section
              aria-label="Blocker"
              className="flex items-start gap-2 rounded-lg border border-status-blocked/30 bg-status-blocked/5 p-4 text-sm"
            >
              <CircleSlash className="mt-0.5 size-4 shrink-0 text-status-blocked" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-medium text-status-blocked">Blocked</p>
                <p className="whitespace-pre-wrap">{task.blocker_details}</p>
              </div>
            </section>
          ) : null}

          <Section title="Description" id="description-heading">
            {task.description ? (
              // Plain text until the sanitized Markdown renderer lands in Phase 6.
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No description.{" "}
                {!archived ? (
                  <Link href={`/tasks/${task.id}/edit`} className="underline underline-offset-4">
                    Add one
                  </Link>
                ) : null}
              </p>
            )}
          </Section>

          <Section title="Subtasks" id="subtasks-heading">
            <SubtasksPanel taskId={task.id} subtasks={rel.subtasks} readOnly={archived} />
          </Section>

          <Section title="Dependencies" id="dependencies-heading">
            <DependenciesPanel
              taskId={task.id}
              dependsOn={rel.dependsOn}
              blocking={rel.blocking}
              options={options}
              readOnly={archived}
            />
          </Section>

          <Section title="Comments" id="comments-heading">
            <CommentsPanel
              taskId={task.id}
              comments={rel.comments}
              timeZone={tz}
              readOnly={archived}
            />
          </Section>

          <Section title="Activity" id="activity-heading">
            <ActivityList events={rel.activity} timeZone={tz} />
          </Section>
        </div>

        <aside className="order-first flex flex-col gap-6 lg:order-none lg:border-l lg:pl-6">
          <dl className="flex flex-col gap-3">
            <Detail label="Repository">
              {task.repository ? (
                <Link
                  href={`/projects/${task.project.id}/repositories`}
                  className="underline-offset-4 hover:underline"
                >
                  {task.repository.name}
                  {task.repository.default_branch ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {task.repository.default_branch}
                    </span>
                  ) : null}
                </Link>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </Detail>
            <Detail label="Due">
              <DueDate dueAt={task.due_at} overdue={isOverdue(task)} timeZone={tz} />
            </Detail>
            {task.completed_at ? (
              <Detail label="Completed">{formatDateTime(task.completed_at, tz)}</Detail>
            ) : null}
            <Detail label="Created">{formatDateTime(task.created_at, tz)}</Detail>
            <Detail label="Updated">{formatDateTime(task.updated_at, tz)}</Detail>
          </dl>

          <div className="flex flex-col gap-2">
            <h2 className="text-xs text-muted-foreground">Labels</h2>
            <LabelsEditor
              taskId={task.id}
              labels={rel.labels}
              allLabels={allLabels}
              readOnly={archived}
            />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-xs text-muted-foreground">Links</h2>
            <LinksPanel
              taskId={task.id}
              referenceUrl={task.external_reference_url}
              links={rel.links}
              readOnly={archived}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
            <h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="size-3.5" aria-hidden />
              Continuity
            </h2>
            <p className="text-xs text-muted-foreground">
              The latest handoff and work-session history show here once work sessions arrive (Phase
              4).
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
