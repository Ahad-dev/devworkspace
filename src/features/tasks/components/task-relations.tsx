"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { TaskStatusBadge } from "@/components/shared/domain-badges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import type { TaskStatus } from "@/lib/constants/domain"
import { formatDateTime, formatRelative } from "@/lib/format"
import { addComment, addDependency, addSubtask, deleteComment, removeDependency } from "../actions"
import { useInlineForm } from "./use-inline-form"
import { offlineFormState, offlineResult, whenOnline } from "@/lib/offline/guard"

type TaskRef = { id: string; title: string; status: TaskStatus }

function FieldMessage({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

function TaskRefRow({ task, action }: { task: TaskRef; action?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 px-3 py-2 text-sm">
      <TaskStatusBadge status={task.status} />
      <Link
        href={`/tasks/${task.id}`}
        className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
      >
        {task.title}
      </Link>
      {action}
    </li>
  )
}

/* Subtasks ------------------------------------------------------------------- */

export function SubtasksPanel({
  taskId,
  subtasks,
  readOnly,
}: {
  taskId: string
  subtasks: (TaskRef & { archived_at: string | null })[]
  readOnly?: boolean
}) {
  const { pending, formRef, onSubmit, error } = useInlineForm(addSubtask.bind(null, taskId))
  const open = subtasks.filter((s) => s.status !== "done" && !s.archived_at)
  const done = subtasks.filter((s) => s.status === "done").length

  return (
    <div className="flex flex-col gap-3">
      {subtasks.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {done} of {subtasks.length} done{open.length ? ` · ${open.length} open` : ""}
          </p>
          <ul className="flex flex-col divide-y rounded-lg border">
            {subtasks.map((s) => (
              <TaskRefRow key={s.id} task={s} />
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No subtasks.</p>
      )}
      {!readOnly ? (
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <label htmlFor="subtask-title" className="sr-only">
              New subtask title
            </label>
            <Input
              id="subtask-title"
              name="title"
              maxLength={300}
              placeholder="Add a subtask (goes to Inbox)"
              className="h-8"
              aria-invalid={Boolean(error("title"))}
              aria-describedby={error("title") ? "subtask-error" : undefined}
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus />}
              Add
            </Button>
          </div>
          <FieldMessage id="subtask-error" message={error("title") ?? error()} />
        </form>
      ) : null}
    </div>
  )
}

/* Dependencies --------------------------------------------------------------- */

export function DependenciesPanel({
  taskId,
  dependsOn,
  blocking,
  options,
  readOnly,
}: {
  taskId: string
  dependsOn: TaskRef[]
  blocking: TaskRef[]
  /** Same-project tasks (the database enforces the same rule). */
  options: TaskRef[]
  readOnly?: boolean
}) {
  const [choice, setChoice] = React.useState("")
  const [removing, startRemove] = React.useTransition()
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await whenOnline(() => addDependency(taskId, prev, formData), offlineFormState)
      if (result.status === "success") setChoice("")
      return result
    },
    initialFormState,
  )
  const error =
    state.status === "error" ? (state.fieldErrors?.depends_on_task_id?.[0] ?? state.message) : null

  const linked = new Set(dependsOn.map((d) => d.id))
  const available = options.filter((o) => !linked.has(o.id))
  const waiting = dependsOn.filter((d) => d.status !== "done").length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          Depends on
          {waiting ? (
            <span className="ml-2 text-xs font-normal text-status-blocked">
              waiting on {waiting}
            </span>
          ) : null}
        </h3>
        {dependsOn.length ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {dependsOn.map((d) => (
              <TaskRefRow
                key={d.id}
                task={d}
                action={
                  readOnly ? null : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove dependency on ${d.title}`}
                      disabled={removing}
                      onClick={() =>
                        startRemove(async () => {
                          const r = await whenOnline(
                            () => removeDependency({ taskId, dependsOnId: d.id }),
                            offlineResult,
                          )
                          if (!r.ok) toast.error(r.error)
                        })
                      }
                    >
                      <X />
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Doesn&apos;t depend on other tasks.</p>
        )}
        {!readOnly && available.length > 0 ? (
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const data = new FormData(e.currentTarget)
              React.startTransition(() => dispatch(data))
            }}
          >
            <div className="flex gap-2">
              <Select name="depends_on_task_id" value={choice} onValueChange={setChoice}>
                <SelectTrigger
                  size="sm"
                  className="min-w-0 flex-1"
                  aria-label="Task this one depends on"
                  aria-invalid={Boolean(error)}
                >
                  <SelectValue placeholder="Add a task this depends on…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" variant="outline" disabled={pending || !choice}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus />}
                Add
              </Button>
            </div>
            <FieldMessage id="dependency-error" message={error ?? undefined} />
          </form>
        ) : null}
      </div>

      {blocking.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Blocking</h3>
          <ul className="flex flex-col divide-y rounded-lg border">
            {blocking.map((d) => (
              <TaskRefRow key={d.id} task={d} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/* Comments ------------------------------------------------------------------- */

export function CommentsPanel({
  taskId,
  comments,
  timeZone,
  readOnly,
}: {
  taskId: string
  comments: { id: string; content: string; created_at: string }[]
  timeZone: string
  readOnly?: boolean
}) {
  const { pending, formRef, onSubmit, error } = useInlineForm(addComment.bind(null, taskId))
  const [deleting, startDelete] = React.useTransition()

  return (
    <div className="flex flex-col gap-3">
      {comments.length ? (
        <ol className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="group flex flex-col gap-1 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <time
                  dateTime={c.created_at}
                  title={formatDateTime(c.created_at, timeZone) ?? undefined}
                  className="text-xs text-muted-foreground"
                >
                  {formatRelative(c.created_at)}
                </time>
                {!readOnly ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete comment"
                    disabled={deleting}
                    className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() =>
                      startDelete(async () => {
                        const r = await whenOnline(
                          () => deleteComment({ taskId, commentId: c.id }),
                          offlineResult,
                        )
                        if (!r.ok) toast.error(r.error)
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          No comments yet. Use them for progress notes and findings.
        </p>
      )}
      {!readOnly ? (
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2">
          <label htmlFor="comment-content" className="sr-only">
            Add a comment
          </label>
          <Textarea
            id="comment-content"
            name="content"
            rows={3}
            maxLength={10000}
            placeholder="Progress note, finding or decision…"
            aria-invalid={Boolean(error("content"))}
            aria-describedby={error("content") ? "comment-error" : undefined}
          />
          <FieldMessage id="comment-error" message={error("content") ?? error()} />
          <div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Comment
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
