"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import {
  EDITABLE_PROJECT_STATUSES,
  PRIORITIES,
  PRIORITY_META,
  PROJECT_STATUS_META,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
} from "@/lib/constants/domain"
import type { Database } from "@/types/database.types"
import { updateProject } from "../actions"
import { initialFormState } from "../schemas"

type Project = Database["public"]["Tables"]["projects"]["Row"]

/** Full project edit form (Spec FR-03 fields; Plan P2.7). */
export function ProjectForm({ project }: { project: Project }) {
  const [state, formAction, pending] = useActionState(
    updateProject.bind(null, project.id),
    initialFormState,
  )
  const err = (k: string) => state.fieldErrors?.[k]
  const archived = project.status === "archived"

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6" noValidate>
      {state.status === "error" && state.message ? (
        <FormMessage status="error">{state.message}</FormMessage>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(err("name"))}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={project.name}
            maxLength={120}
            aria-invalid={Boolean(err("name"))}
          />
          <FieldError errors={toFieldErrors(err("name"))} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="project_type">Type</FieldLabel>
            <Select name="project_type" defaultValue={project.project_type}>
              <SelectTrigger id="project_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PROJECT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            {archived ? (
              <>
                <Input id="status" value="Archived" disabled readOnly />
                <FieldDescription>Restore the project to change its status.</FieldDescription>
              </>
            ) : (
              <Select name="status" defaultValue={project.status}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="priority">Priority</FieldLabel>
            <Select name="priority" defaultValue={project.priority ?? "none"}>
              <SelectTrigger id="priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field data-invalid={Boolean(err("description"))}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={project.description ?? ""}
            placeholder="Purpose and scope of the project."
            aria-invalid={Boolean(err("description"))}
          />
          <FieldError errors={toFieldErrors(err("description"))} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(err("start_date"))}>
            <FieldLabel htmlFor="start_date">Start date</FieldLabel>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={project.start_date ?? ""}
              aria-invalid={Boolean(err("start_date"))}
            />
            <FieldError errors={toFieldErrors(err("start_date"))} />
          </Field>
          <Field data-invalid={Boolean(err("target_date"))}>
            <FieldLabel htmlFor="target_date">Target date</FieldLabel>
            <Input
              id="target_date"
              name="target_date"
              type="date"
              defaultValue={project.target_date ?? ""}
              aria-invalid={Boolean(err("target_date"))}
            />
            <FieldError errors={toFieldErrors(err("target_date"))} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(err("project_url"))}>
            <FieldLabel htmlFor="project_url">Project URL</FieldLabel>
            <Input
              id="project_url"
              name="project_url"
              type="url"
              defaultValue={project.project_url ?? ""}
              placeholder="https://"
              aria-invalid={Boolean(err("project_url"))}
            />
            <FieldError errors={toFieldErrors(err("project_url"))} />
          </Field>
          <Field data-invalid={Boolean(err("documentation_url"))}>
            <FieldLabel htmlFor="documentation_url">Documentation URL</FieldLabel>
            <Input
              id="documentation_url"
              name="documentation_url"
              type="url"
              defaultValue={project.documentation_url ?? ""}
              placeholder="https://"
              aria-invalid={Boolean(err("documentation_url"))}
            />
            <FieldError errors={toFieldErrors(err("documentation_url"))} />
          </Field>
        </div>

        <Field data-invalid={Boolean(err("notes"))}>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={project.notes ?? ""}
            aria-invalid={Boolean(err("notes"))}
          />
          <FieldDescription>
            Brief context. Never secrets: values that look like keys or passwords are rejected.
          </FieldDescription>
          <FieldError errors={toFieldErrors(err("notes"))} />
        </Field>
      </FieldGroup>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/projects/${project.id}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
