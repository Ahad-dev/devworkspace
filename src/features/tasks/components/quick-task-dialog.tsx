"use client"

import * as React from "react"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import { createQuickTask } from "../actions"
import { offlineFormState, whenOnline } from "@/lib/offline/guard"

type Option = { id: string; name: string }

/**
 * Quick capture (Spec FR-02/FR-06; Plan P3.9): a title and a project, saved to Inbox for triage
 * later. `projects` is either a list or a promise (the header loads it when the dialog opens).
 * Controlled when `open` is passed; otherwise renders its own trigger button.
 */
export function QuickTaskDialog({
  projects,
  fixedProject,
  open,
  onOpenChange,
  triggerLabel = "Quick add",
}: {
  projects?: Option[] | Promise<Option[]>
  fixedProject?: Option
  open?: boolean
  onOpenChange?: (open: boolean) => void
  triggerLabel?: string
}) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const actualOpen = isControlled ? open : internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => (isControlled ? onOpenChange?.(next) : setInternalOpen(next)),
    [isControlled, onOpenChange],
  )

  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await whenOnline(() => createQuickTask(prev, formData), offlineFormState)
      if (result.status === "success") {
        const id = (result.data as { id?: string } | undefined)?.id
        setOpen(false)
        toast.success("Task added to Inbox", {
          action: id ? { label: "Open", onClick: () => router.push(`/tasks/${id}`) } : undefined,
        })
      }
      return result
    },
    initialFormState,
  )

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      {!isControlled ? (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Plus />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => formAction(data))
          }}
          className="flex flex-col gap-6"
          noValidate
        >
          <DialogHeader>
            <DialogTitle>Quick add task</DialogTitle>
            <DialogDescription>
              Capture it now and triage it later. It goes to the Inbox.
            </DialogDescription>
          </DialogHeader>

          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}

          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.title)}>
              <FieldLabel htmlFor="quick-task-title">Title</FieldLabel>
              <Input
                id="quick-task-title"
                name="title"
                autoFocus
                maxLength={300}
                placeholder="Fix the login redirect on staging"
                aria-invalid={Boolean(state.fieldErrors?.title)}
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.title)} />
            </Field>

            {fixedProject ? (
              <input type="hidden" name="project_id" value={fixedProject.id} />
            ) : (
              <Field data-invalid={Boolean(state.fieldErrors?.project_id)}>
                <FieldLabel htmlFor="quick-task-project">Project</FieldLabel>
                <React.Suspense fallback={<Skeleton className="h-9 w-full" />}>
                  <ProjectSelect
                    projects={projects ?? []}
                    invalid={Boolean(state.fieldErrors?.project_id)}
                  />
                </React.Suspense>
                <FieldError errors={toFieldErrors(state.fieldErrors?.project_id)} />
              </Field>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Add to Inbox
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProjectSelect({
  projects,
  invalid,
}: {
  projects: Option[] | Promise<Option[]>
  invalid: boolean
}) {
  const list = projects instanceof Promise ? React.use(projects) : projects
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a project first: every task belongs to one.
      </p>
    )
  }
  return (
    <Select name="project_id" defaultValue={list.length === 1 ? list[0]?.id : undefined}>
      <SelectTrigger id="quick-task-project" className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder="Choose a project" />
      </SelectTrigger>
      <SelectContent>
        {list.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
