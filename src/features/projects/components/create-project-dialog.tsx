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
import { PROJECT_TYPE_LABELS, PROJECT_TYPES } from "@/lib/constants/domain"
import { createProject } from "../actions"
import { initialFormState } from "../schemas"

/**
 * Create a project with just a name and type (Spec FR-03: "created with only its required
 * fields"). Everything else is added later from the project's edit page.
 * Controlled when `open` is passed (header quick-create); otherwise renders its own button.
 */
export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const actualOpen = isControlled ? open : internalOpen
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen

  const [state, formAction, pending] = useActionState(createProject, initialFormState)

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      {!isControlled ? (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus />
            New project
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Start with a name and type. You can add repositories, the stack and links next.
            </DialogDescription>
          </DialogHeader>

          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}

          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.name)}>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input
                id="project-name"
                name="name"
                autoFocus
                maxLength={120}
                aria-invalid={Boolean(state.fieldErrors?.name)}
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.name)} />
            </Field>
            <Field data-invalid={Boolean(state.fieldErrors?.project_type)}>
              <FieldLabel htmlFor="project-type">Type</FieldLabel>
              <Select name="project_type" defaultValue="personal">
                <SelectTrigger id="project-type" className="w-full">
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
              <FieldError errors={toFieldErrors(state.fieldErrors?.project_type)} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
