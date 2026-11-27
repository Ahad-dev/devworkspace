"use client"

import * as React from "react"
import { useActionState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { MoreDetails } from "@/components/shared/more-details"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import {
  REPOSITORY_PROVIDER_LABELS,
  REPOSITORY_PROVIDERS,
  REPOSITORY_PURPOSE_LABELS,
  REPOSITORY_PURPOSES,
} from "@/lib/constants/domain"
import type { Database } from "@/types/database.types"
import { createRepository, updateRepository } from "../actions"
import { initialFormState, type FormState } from "../schemas"

export type RepositoryRow = Database["public"]["Tables"]["repositories"]["Row"]

/** Add or edit a repository (Spec FR-04). Never asks for credentials. */
export function RepositoryDialog({
  projectId,
  repository,
  open,
  onOpenChange,
}: {
  projectId: string
  repository?: RepositoryRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const action = repository
    ? updateRepository.bind(null, { projectId, repositoryId: repository.id })
    : createRepository.bind(null, projectId)
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, initialFormState)

  // Close once the save succeeds.
  React.useEffect(() => {
    if (state.status === "success") onOpenChange(false)
  }, [state, onOpenChange])

  const err = (k: string) => state.fieldErrors?.[k]
  // Fold the extras unless one is filled in or has an error (Plan P10.4).
  const hasMore =
    Boolean(
      repository &&
      (repository.default_branch ||
        repository.primary_language ||
        repository.local_path ||
        repository.readme_url ||
        repository.notes ||
        repository.provider !== "github" ||
        repository.purpose !== "other"),
    ) ||
    ["default_branch", "primary_language", "local_path", "readme_url", "notes"].some((k) =>
      Boolean(err(k)),
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form action={formAction} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>{repository ? `Edit ${repository.name}` : "Add repository"}</DialogTitle>
            <DialogDescription>
              Where this project&apos;s code lives. Never paste tokens or passwords: remotes with
              credentials are rejected.
            </DialogDescription>
          </DialogHeader>

          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}

          <FieldGroup>
            <Field data-invalid={Boolean(err("name"))}>
              <FieldLabel htmlFor="repo-name">Name</FieldLabel>
              <Input
                id="repo-name"
                name="name"
                defaultValue={repository?.name ?? ""}
                autoFocus
                maxLength={200}
                aria-invalid={Boolean(err("name"))}
              />
              <FieldError errors={toFieldErrors(err("name"))} />
            </Field>

            <Field data-invalid={Boolean(err("remote_url"))}>
              <FieldLabel htmlFor="repo-remote">Remote URL</FieldLabel>
              <Input
                id="repo-remote"
                name="remote_url"
                defaultValue={repository?.remote_url ?? ""}
                placeholder="https://github.com/owner/repo or git@github.com:owner/repo.git"
                aria-invalid={Boolean(err("remote_url"))}
              />
              <FieldError errors={toFieldErrors(err("remote_url"))} />
            </Field>

            <MoreDetails open={hasMore} hint="provider, branch, local path, notes">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="repo-provider">Provider</FieldLabel>
                  <Select name="provider" defaultValue={repository?.provider ?? "github"}>
                    <SelectTrigger id="repo-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPOSITORY_PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {REPOSITORY_PROVIDER_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="repo-purpose">Purpose</FieldLabel>
                  <Select name="purpose" defaultValue={repository?.purpose ?? "other"}>
                    <SelectTrigger id="repo-purpose" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPOSITORY_PURPOSES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {REPOSITORY_PURPOSE_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(err("default_branch"))}>
                  <FieldLabel htmlFor="repo-branch">Default branch</FieldLabel>
                  <Input
                    id="repo-branch"
                    name="default_branch"
                    defaultValue={repository?.default_branch ?? ""}
                    placeholder="main"
                    aria-invalid={Boolean(err("default_branch"))}
                  />
                  <FieldError errors={toFieldErrors(err("default_branch"))} />
                </Field>
                <Field data-invalid={Boolean(err("primary_language"))}>
                  <FieldLabel htmlFor="repo-lang">Language / framework</FieldLabel>
                  <Input
                    id="repo-lang"
                    name="primary_language"
                    defaultValue={repository?.primary_language ?? ""}
                    placeholder="TypeScript"
                    aria-invalid={Boolean(err("primary_language"))}
                  />
                  <FieldError errors={toFieldErrors(err("primary_language"))} />
                </Field>
              </div>

              <Field data-invalid={Boolean(err("local_path"))}>
                <FieldLabel htmlFor="repo-path">Local path</FieldLabel>
                <Input
                  id="repo-path"
                  name="local_path"
                  defaultValue={repository?.local_path ?? ""}
                  placeholder={"D:\\Code\\my-project"}
                  aria-invalid={Boolean(err("local_path"))}
                />
                <FieldDescription>
                  For your reference only. The app never reads it.
                </FieldDescription>
                <FieldError errors={toFieldErrors(err("local_path"))} />
              </Field>

              <Field data-invalid={Boolean(err("readme_url"))}>
                <FieldLabel htmlFor="repo-readme">README URL</FieldLabel>
                <Input
                  id="repo-readme"
                  name="readme_url"
                  type="url"
                  defaultValue={repository?.readme_url ?? ""}
                  aria-invalid={Boolean(err("readme_url"))}
                />
                <FieldError errors={toFieldErrors(err("readme_url"))} />
              </Field>

              <Field data-invalid={Boolean(err("notes"))}>
                <FieldLabel htmlFor="repo-notes">Notes</FieldLabel>
                <Textarea
                  id="repo-notes"
                  name="notes"
                  rows={3}
                  defaultValue={repository?.notes ?? ""}
                  aria-invalid={Boolean(err("notes"))}
                />
                <FieldError errors={toFieldErrors(err("notes"))} />
              </Field>
            </MoreDetails>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {repository ? "Save" : "Add repository"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
