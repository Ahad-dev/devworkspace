import { ChevronLeft, CircleSlash, ExternalLink, Pencil } from "lucide-react"

import { PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import { Markdown } from "@/components/shared/markdown"
import { NextActionCard } from "@/features/tasks/components/next-action-card"
import { DueDate, LabelChips } from "@/features/tasks/components/task-chips"
import { isOverdue } from "@/features/tasks/utils"
import { formatDateTime } from "@/lib/format"
import type { OfflineTask, TaskRef } from "../snapshot"

/** Read-only task detail from the offline copy (Plan P9.4). */
export function OfflineTaskDetail({
  detail,
  editing,
  timeZone,
  now,
}: {
  detail: {
    task: OfflineTask
    parent: TaskRef | null
    subtasks: TaskRef[]
    dependsOn: TaskRef[]
    blocking: TaskRef[]
  }
  editing: boolean
  timeZone: string
  now: Date
}) {
  const { task, parent, subtasks, dependsOn, blocking } = detail
  return (
    <div className="flex flex-col gap-5">
      <a
        href={`/projects/${task.project_id}/tasks`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {task.project?.name ?? "Project"} tasks
      </a>

      <header className="flex min-w-0 flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight break-words">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <TaskStatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          <span aria-hidden>·</span>
          <span>{task.project?.name}</span>
          {parent ? (
            <>
              <span aria-hidden>·</span>
              <span>
                Subtask of{" "}
                <a
                  href={`/tasks/${parent.id}`}
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  {parent.title}
                </a>
              </span>
            </>
          ) : null}
        </div>
      </header>

      {editing ? (
        <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Pencil className="size-4" aria-hidden />
          Editing needs a connection. This is the saved copy of the task.
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <NextActionCard
            taskId={task.id}
            status={task.status}
            nextAction={task.next_action}
            readOnly
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

          <Section title="Description" id="offline-description">
            {task.description ? (
              <Markdown>{task.description}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">No description.</p>
            )}
          </Section>

          <Section title="Subtasks" id="offline-subtasks">
            <RefList refs={subtasks} empty="No subtasks in the saved copy." />
          </Section>

          <Section title="Dependencies" id="offline-dependencies">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-medium">Depends on</h3>
                <RefList refs={dependsOn} empty="Nothing." />
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-medium">Blocking</h3>
                <RefList refs={blocking} empty="Nothing." />
              </div>
            </div>
          </Section>

          <Section title="Comments" id="offline-comments">
            {task.comments.length ? (
              <ol className="flex flex-col gap-3">
                {task.comments.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(c.created_at, timeZone)}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No comments.</p>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-4">
          <dl className="flex flex-col gap-3">
            <Detail label="Due">
              <DueDate dueAt={task.due_at} overdue={isOverdue(task, now)} timeZone={timeZone} />
            </Detail>
            <Detail label="Repository">{task.repository?.name ?? "-"}</Detail>
            <Detail label="Labels">
              {task.labels.length ? <LabelChips labels={task.labels} max={10} /> : "-"}
            </Detail>
            <Detail label="Updated">{formatDateTime(task.updated_at, timeZone)}</Detail>
            {task.completed_at ? (
              <Detail label="Completed">{formatDateTime(task.completed_at, timeZone)}</Detail>
            ) : null}
          </dl>
          {task.links.length ? (
            <section aria-labelledby="offline-links" className="flex flex-col gap-2">
              <h2 id="offline-links" className="text-sm font-medium">
                Links
              </h2>
              <ul className="flex flex-col gap-1 text-sm">
                {task.links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      {l.label || l.url}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function Section({
  title,
  id,
  children,
}: {
  title: string
  id: string
  children: React.ReactNode
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

function RefList({ refs, empty }: { refs: TaskRef[]; empty: string }) {
  if (!refs.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="flex flex-col gap-1.5">
      {refs.map((r) => (
        <li key={r.id} className="flex items-center gap-2 text-sm">
          <TaskStatusBadge status={r.status} />
          <a href={`/tasks/${r.id}`} className="underline-offset-4 hover:underline">
            {r.title}
          </a>
        </li>
      ))}
    </ul>
  )
}
