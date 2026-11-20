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
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS } from "@/lib/constants/domain"
import { createDocument } from "../actions"

const NONE = "none"

/** New document: a title, a category and (outside a project) an optional project. */
export function CreateDocumentDialog({
  projectId,
  projects,
  defaultProjectId,
  open: controlledOpen,
  onOpenChange,
}: {
  /** Inside a project: the document belongs to it. */
  projectId?: string
  /** On the global page: projects to choose from. */
  projects?: { id: string; name: string }[]
  defaultProjectId?: string | null
  /** Controlled (quick-create): no trigger button is rendered. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : internalOpen
  const setOpen = controlled ? (onOpenChange ?? (() => {})) : setInternalOpen
  const [title, setTitle] = React.useState("")
  const [category, setCategory] = React.useState("general")
  const [project, setProject] = React.useState(defaultProjectId ?? NONE)
  const [state, formAction, pending] = useActionState(
    createDocument.bind(null, { projectId: projectId ?? null }),
    initialFormState,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled ? (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus />
            New document
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        {/* Redirecting action: submitted through the form action. */}
        <form action={formAction} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>New document</DialogTitle>
            <DialogDescription>
              A setup guide, runbook, decision record or note. You write it in Markdown next.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.title)}>
              <FieldLabel htmlFor="doc-title">Title</FieldLabel>
              <Input
                id="doc-title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                placeholder="e.g. Local setup"
                aria-invalid={Boolean(state.fieldErrors?.title)}
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.title)} />
            </Field>
            <Field data-invalid={Boolean(state.fieldErrors?.category)}>
              <FieldLabel htmlFor="doc-category">Category</FieldLabel>
              <Select name="category" value={category} onValueChange={setCategory}>
                <SelectTrigger id="doc-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {DOC_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={toFieldErrors(state.fieldErrors?.category)} />
            </Field>
            {projects && !projectId ? (
              <Field data-invalid={Boolean(state.fieldErrors?.project_id)}>
                <FieldLabel htmlFor="doc-project">Project</FieldLabel>
                <Select name="project_id" value={project} onValueChange={setProject}>
                  <SelectTrigger id="doc-project" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No project (global)</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={toFieldErrors(state.fieldErrors?.project_id)} />
              </Field>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Create document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
