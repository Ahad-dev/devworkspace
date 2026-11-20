"use client"

import { EnvironmentBadge } from "@/components/shared/domain-badges"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toFieldErrors } from "@/features/auth/components/form-message"
import type { EnvironmentType } from "@/lib/constants/domain"
import type { LinkOptions } from "../queries"

export type LinkValue = {
  project_id: string | null
  repository_id: string | null
  environment_id: string | null
}

const NONE = "none"

/**
 * Project, repository and environment for a document or command. Repositories and environments
 * come from the chosen project only; a global item has neither (the database enforces both).
 */
export function LinkFields({
  idPrefix,
  options,
  value,
  onChange,
  fixedProject,
  errors,
  disabled,
}: {
  idPrefix: string
  options: LinkOptions
  value: LinkValue
  onChange: (next: LinkValue) => void
  /** Inside a project: the project can't be changed here. */
  fixedProject?: boolean
  errors?: Partial<Record<string, string[]>>
  disabled?: boolean
}) {
  const projects = options.projects.filter(
    (p) => p.status !== "archived" || p.id === value.project_id,
  )
  const repositories = options.repositories.filter((r) => r.project_id === value.project_id)
  const environments = options.environments.filter(
    (e) => e.project_id === value.project_id || e.id === value.environment_id,
  )
  const noProject = !value.project_id

  return (
    <>
      {!fixedProject ? (
        <Field data-invalid={Boolean(errors?.project_id)}>
          <FieldLabel htmlFor={`${idPrefix}-project`}>Project</FieldLabel>
          <Select
            name="project_id"
            value={value.project_id ?? NONE}
            disabled={disabled}
            onValueChange={(v) =>
              onChange({
                project_id: v === NONE ? null : v,
                repository_id: null,
                environment_id: null,
              })
            }
          >
            <SelectTrigger id={`${idPrefix}-project`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No project (global)</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.status === "archived" ? " (archived)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={toFieldErrors(errors?.project_id)} />
        </Field>
      ) : (
        <input type="hidden" name="project_id" value={value.project_id ?? ""} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors?.repository_id)}>
          <FieldLabel htmlFor={`${idPrefix}-repository`}>Repository</FieldLabel>
          <Select
            name="repository_id"
            value={value.repository_id ?? NONE}
            disabled={disabled || noProject}
            onValueChange={(v) => onChange({ ...value, repository_id: v === NONE ? null : v })}
          >
            <SelectTrigger id={`${idPrefix}-repository`} className="w-full">
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
          {noProject ? <FieldDescription>Choose a project first.</FieldDescription> : null}
          <FieldError errors={toFieldErrors(errors?.repository_id)} />
        </Field>
        <Field data-invalid={Boolean(errors?.environment_id)}>
          <FieldLabel htmlFor={`${idPrefix}-environment`}>Environment</FieldLabel>
          <Select
            name="environment_id"
            value={value.environment_id ?? NONE}
            disabled={disabled || noProject}
            onValueChange={(v) => onChange({ ...value, environment_id: v === NONE ? null : v })}
          >
            <SelectTrigger id={`${idPrefix}-environment`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {environments.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <span className="flex items-center gap-2">
                    <EnvironmentBadge
                      type={e.environment_type as EnvironmentType}
                      variant="short"
                    />
                    {e.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={toFieldErrors(errors?.environment_id)} />
        </Field>
      </div>
    </>
  )
}
