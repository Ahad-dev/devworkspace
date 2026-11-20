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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState } from "@/features/projects/schemas"
import { ENVIRONMENT_TYPE_META, ENVIRONMENT_TYPES } from "@/lib/constants/domain"
import { createEnvironmentFromForm } from "../actions"

const DEFAULT_NAME: Record<string, string> = {
  local: "Local",
  development: "Development",
  staging: "Staging",
  production: "Production",
  custom: "",
}

/** Quick-create an environment (Plan P7.3): project, type and name; details on its page. */
export function QuickEnvironmentDialog({
  projects,
  open,
  onOpenChange,
}: {
  projects: { id: string; name: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [project, setProject] = React.useState(projects.length === 1 ? projects[0]!.id : "")
  const [type, setType] = React.useState("development")
  const [name, setName] = React.useState("Development")
  const [touched, setTouched] = React.useState(false)
  const [state, formAction, pending] = useActionState(createEnvironmentFromForm, initialFormState)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Redirecting action: submitted through the form action. */}
        <form action={formAction} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>New environment</DialogTitle>
            <DialogDescription>
              Pick the project, a type and a name. URLs, hosts, services and variables come next.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          {projects.length ? (
            <FieldGroup>
              <Field data-invalid={Boolean(state.fieldErrors?.project_id)}>
                <FieldLabel htmlFor="quick-env-project">Project</FieldLabel>
                <Select name="project_id" value={project} onValueChange={setProject}>
                  <SelectTrigger id="quick-env-project" className="w-full">
                    <SelectValue placeholder="Choose a project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={toFieldErrors(state.fieldErrors?.project_id)} />
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.environment_type)}>
                <FieldLabel htmlFor="quick-env-type">Type</FieldLabel>
                <Select
                  name="environment_type"
                  value={type}
                  onValueChange={(v) => {
                    setType(v)
                    if (!touched) setName(DEFAULT_NAME[v] ?? "")
                  }}
                >
                  <SelectTrigger id="quick-env-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ENVIRONMENT_TYPE_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={toFieldErrors(state.fieldErrors?.environment_type)} />
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.name)}>
                <FieldLabel htmlFor="quick-env-name">Name</FieldLabel>
                <Input
                  id="quick-env-name"
                  name="name"
                  value={name}
                  onChange={(e) => {
                    setTouched(true)
                    setName(e.target.value)
                  }}
                  maxLength={100}
                  aria-invalid={Boolean(state.fieldErrors?.name)}
                />
                <FieldError errors={toFieldErrors(state.fieldErrors?.name)} />
              </Field>
            </FieldGroup>
          ) : (
            <p className="text-sm text-muted-foreground">
              Environments belong to a project. Create a project first.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !projects.length}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Create environment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
