"use client"

import * as React from "react"
import { useActionState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MoreDetails } from "@/components/shared/more-details"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import {
  PRIORITIES,
  PRIORITY_META,
  TASK_STATUSES,
  TASK_STATUS_META,
  type Priority,
  type TaskStatus,
} from "@/lib/constants/domain"
import { offlineFormState, whenOnline } from "@/lib/offline/guard"

type Option = { id: string; name: string }
const NONE = "none"

export type TaskFormDefaults = {
  title: string
  status: TaskStatus
  priority: Priority
  description: string
  next_action: string
  blocker_details: string
  due_date: string
  repository_id: string | null
  parent_task_id: string | null
  external_reference_url: string
}

export const EMPTY_TASK: TaskFormDefaults = {
  title: "",
  // Full form defaults to Ready (Plan §9 decision 1); quick capture uses Inbox.
  status: "ready",
  priority: "medium",
  description: "",
  next_action: "",
  blocker_details: "",
  due_date: "",
  repository_id: null,
  parent_task_id: null,
  external_reference_url: "",
}

/**
 * Full task form (Spec FR-06 fields; Plan P3.9). Used to create (project chosen here) and edit
 * (project fixed). Repository and parent choices come from the selected project; on the create
 * page, changing the project reloads them through the URL while the typed fields are kept.
 */
export function TaskForm({
  action,
  defaults,
  projects,
  projectId,
  repositories,
  parentOptions,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  defaults: TaskFormDefaults
  /** Create mode: the project picker. Omit when editing. */
  projects?: Option[]
  projectId: string | null
  repositories: Option[]
  parentOptions: Option[]
  submitLabel: string
  cancelHref: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, formAction, pending] = useActionState(
    (prev: FormState, formData: FormData) =>
      whenOnline(() => action(prev, formData), offlineFormState),
    initialFormState,
  )
  const [status, setStatus] = React.useState<TaskStatus>(defaults.status)
  const err = (k: string) => state.fieldErrors?.[k]
  // Fold the extras unless one is filled in or has an error (Plan P10.4).
  const hasMore =
    Boolean(defaults.repository_id || defaults.parent_task_id || defaults.external_reference_url) ||
    ["repository_id", "parent_task_id", "external_reference_url"].some((k) => Boolean(err(k)))

  return (
    <form
      // Dispatch instead of the action prop: React resets uncontrolled fields after a form
      // action, which would wipe a long form when validation fails.
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        React.startTransition(() => formAction(data))
      }}
      className="flex max-w-3xl flex-col gap-6"
      noValidate
    >
      {state.status === "error" && state.message ? (
        <FormMessage status="error">{state.message}</FormMessage>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(err("title"))}>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={defaults.title}
            maxLength={300}
            autoFocus={!defaults.title}
            placeholder="Add rate limiting to the public API"
            aria-invalid={Boolean(err("title"))}
          />
          <FieldError errors={toFieldErrors(err("title"))} />
        </Field>

        {projects ? (
          <Field data-invalid={Boolean(err("project_id"))}>
            <FieldLabel htmlFor="project_id">Project</FieldLabel>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every task belongs to a project.{" "}
                <Link href="/projects" className="underline underline-offset-4">
                  Create a project
                </Link>{" "}
                first.
              </p>
            ) : (
              <Select
                name="project_id"
                value={projectId ?? undefined}
                onValueChange={(v) => router.replace(`${pathname}?project=${v}`, { scroll: false })}
              >
                <SelectTrigger
                  id="project_id"
                  className="w-full sm:w-80"
                  aria-invalid={Boolean(err("project_id"))}
                >
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError errors={toFieldErrors(err("project_id"))} />
          </Field>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-3">
          <Field data-invalid={Boolean(err("status"))}>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <Select name="status" value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={toFieldErrors(err("status"))} />
          </Field>
          <Field data-invalid={Boolean(err("priority"))}>
            <FieldLabel htmlFor="priority">Priority</FieldLabel>
            <Select name="priority" defaultValue={defaults.priority}>
              <SelectTrigger id="priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={toFieldErrors(err("priority"))} />
          </Field>
          <Field data-invalid={Boolean(err("due_date"))}>
            <FieldLabel htmlFor="due_date">Due date</FieldLabel>
            <Input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={defaults.due_date}
              aria-invalid={Boolean(err("due_date"))}
            />
            <FieldError errors={toFieldErrors(err("due_date"))} />
          </Field>
        </div>

        {status === "blocked" ? (
          <Field data-invalid={Boolean(err("blocker_details"))}>
            <FieldLabel htmlFor="blocker_details">Blocker details</FieldLabel>
            <Textarea
              id="blocker_details"
              name="blocker_details"
              defaultValue={defaults.blocker_details}
              maxLength={2000}
              rows={3}
              placeholder="Waiting for the client to send staging access"
              aria-invalid={Boolean(err("blocker_details"))}
            />
            <FieldDescription>
              Required for blocked tasks: what are you waiting on?
            </FieldDescription>
            <FieldError errors={toFieldErrors(err("blocker_details"))} />
          </Field>
        ) : null}

        <Field data-invalid={Boolean(err("next_action"))}>
          <FieldLabel htmlFor="next_action">Next action</FieldLabel>
          <Input
            id="next_action"
            name="next_action"
            defaultValue={defaults.next_action}
            maxLength={1000}
            placeholder="Open the auth middleware and add the redirect test"
            aria-invalid={Boolean(err("next_action"))}
          />
          <FieldDescription>
            The first concrete step when you pick this up again. Strongly encouraged for tasks in
            progress.
          </FieldDescription>
          <FieldError errors={toFieldErrors(err("next_action"))} />
        </Field>

        <Field data-invalid={Boolean(err("description"))}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            name="description"
            defaultValue={defaults.description}
            maxLength={50000}
            rows={8}
            placeholder="Context, requirements, acceptance criteria…"
            aria-invalid={Boolean(err("description"))}
          />
          <FieldDescription>
            Keep secrets out: reference where a credential lives, never its value.
          </FieldDescription>
          <FieldError errors={toFieldErrors(err("description"))} />
        </Field>

        <MoreDetails open={hasMore} hint="repository, parent task, external link">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field data-invalid={Boolean(err("repository_id"))}>
              <FieldLabel htmlFor="repository_id">Repository</FieldLabel>
              <Select
                key={`repo-${projectId}`}
                name="repository_id"
                defaultValue={defaults.repository_id ?? NONE}
                disabled={!projectId}
              >
                <SelectTrigger id="repository_id" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {repositories.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={toFieldErrors(err("repository_id"))} />
            </Field>
            <Field data-invalid={Boolean(err("parent_task_id"))}>
              <FieldLabel htmlFor="parent_task_id">Parent task</FieldLabel>
              <Select
                key={`parent-${projectId}`}
                name="parent_task_id"
                defaultValue={defaults.parent_task_id ?? NONE}
                disabled={!projectId}
              >
                <SelectTrigger id="parent_task_id" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {parentOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={toFieldErrors(err("parent_task_id"))} />
            </Field>
          </div>

          <Field data-invalid={Boolean(err("external_reference_url"))}>
            <FieldLabel htmlFor="external_reference_url">External reference</FieldLabel>
            <Input
              id="external_reference_url"
              name="external_reference_url"
              type="url"
              defaultValue={defaults.external_reference_url}
              maxLength={2048}
              placeholder="https://github.com/acme/api/issues/42"
              aria-invalid={Boolean(err("external_reference_url"))}
            />
            <FieldDescription>A ticket, PR, email thread or client reference.</FieldDescription>
            <FieldError errors={toFieldErrors(err("external_reference_url"))} />
          </Field>
        </MoreDetails>
      </FieldGroup>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
