"use client"

import * as React from "react"
import { useActionState } from "react"
import { Loader2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createEnvironment } from "../actions"

const DEFAULT_NAME: Record<string, string> = {
  local: "Local",
  development: "Development",
  staging: "Staging",
  production: "Production",
  custom: "",
}

/** New environment: a name and a type (Spec §5.6). Details are filled in on its page. */
export function CreateEnvironmentDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState("development")
  const [name, setName] = React.useState("Development")
  const [touched, setTouched] = React.useState(false)
  const [state, formAction, pending] = useActionState(
    createEnvironment.bind(null, projectId),
    initialFormState,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New environment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Redirecting action: submitted through the form action (see ProjectActions). */}
        <form action={formAction} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>New environment</DialogTitle>
            <DialogDescription>
              Pick a type and a name. URLs, hosts, services and variables are added next.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.environment_type)}>
              <FieldLabel htmlFor="env-type">Type</FieldLabel>
              <Select
                name="environment_type"
                value={type}
                onValueChange={(v) => {
                  setType(v)
                  if (!touched) setName(DEFAULT_NAME[v] ?? "")
                }}
              >
                <SelectTrigger id="env-type" className="w-full">
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
              <FieldLabel htmlFor="env-name">Name</FieldLabel>
              <Input
                id="env-name"
                name="name"
                value={name}
                onChange={(e) => {
                  setTouched(true)
                  setName(e.target.value)
                }}
                maxLength={100}
                placeholder="e.g. Local (laptop)"
                aria-invalid={Boolean(state.fieldErrors?.name)}
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.name)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Create environment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
