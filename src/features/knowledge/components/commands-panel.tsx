"use client"

import * as React from "react"
import Link from "next/link"
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  SquareTerminal,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { CopyButton } from "@/components/shared/copy-button"
import { EnvironmentBadge } from "@/components/shared/domain-badges"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { MoreDetails } from "@/components/shared/more-details"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  COMMAND_CATEGORIES,
  COMMAND_CATEGORY_LABELS,
  COMMAND_OSES,
  COMMAND_OS_LABELS,
  COMMAND_SHELLS,
  COMMAND_SHELL_LABELS,
  type EnvironmentType,
} from "@/lib/constants/domain"
import { secretMessage } from "@/lib/security/secret-guard"
import { cn } from "@/lib/utils"
import { deleteCommand, saveCommand } from "../actions"
import type { CommandRow, LinkOptions } from "../queries"
import { destructiveReasons } from "../utils"
import { DestructiveBadge, ShellBadge } from "./knowledge-badges"
import { LinkFields, type LinkValue } from "./link-fields"

/* List ------------------------------------------------------------------------- */

function copyWarning(c: CommandRow) {
  const parts = []
  if (c.is_destructive) parts.push("This command is marked destructive.")
  if (c.environment?.environment_type === "production") parts.push("It targets Production.")
  return parts.length ? `${parts.join(" ")} Check where you run it.` : undefined
}

/** Saved commands (Spec FR-11; Plan P6.6). Copy only: DevWorkspace never runs them. */
export function CommandsList({
  commands,
  options,
  projectId,
  showProject,
  filtered,
}: {
  commands: CommandRow[]
  options: LinkOptions
  projectId?: string
  showProject: boolean
  filtered: boolean
}) {
  const [editing, setEditing] = React.useState<CommandRow | null>(null)
  const [deleting, setDeleting] = React.useState<CommandRow | null>(null)
  const [pending, startTransition] = React.useTransition()

  if (commands.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">{filtered ? <SearchX /> : <SquareTerminal />}</EmptyMedia>
          <EmptyTitle>{filtered ? "No commands match" : "No commands yet"}</EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Try a different search, category or project."
              : "Save the setup, build, test, migration and deployment commands you keep looking up. Use placeholders like $DATABASE_URL instead of secrets."}
          </EmptyDescription>
        </EmptyHeader>
        {!filtered ? (
          <EmptyContent>
            <CommandDialogButton options={options} projectId={projectId} />
          </EmptyContent>
        ) : null}
      </Empty>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-3" aria-label="Commands">
        {commands.map((c) => {
          const production = c.environment?.environment_type === "production"
          return (
            <li
              key={c.id}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-lg border p-3",
                production && "border-l-4 border-l-env-production",
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h3 className="text-sm font-medium break-words">{c.title}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {c.is_destructive ? <DestructiveBadge /> : null}
                    <ShellBadge shell={c.shell} os={c.operating_system} />
                    {c.environment ? (
                      <span className="inline-flex items-center gap-1">
                        <EnvironmentBadge
                          type={c.environment.environment_type as EnvironmentType}
                          variant="short"
                        />
                        {c.environment.name}
                      </span>
                    ) : null}
                    <span>{COMMAND_CATEGORY_LABELS[c.category]}</span>
                    {showProject ? (
                      c.project ? (
                        <Link
                          href={`/projects/${c.project.id}/documentation?tab=commands`}
                          className="underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {c.project.name}
                        </Link>
                      ) : (
                        <span>Global</span>
                      )
                    ) : null}
                    {c.repository ? <span className="font-mono">{c.repository.name}</span> : null}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`More actions for ${c.title}`}
                      disabled={pending}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={() => setEditing(c)}>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                      <Trash2 />
                      Delete…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {c.description ? (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{c.description}</p>
              ) : null}

              <div className="flex items-start gap-1 rounded-md border bg-muted/50">
                <pre
                  className="min-w-0 flex-1 overflow-x-auto p-2.5 font-mono text-xs leading-relaxed"
                  aria-label={`Command: ${c.title}`}
                >
                  <code>{c.command_text}</code>
                </pre>
                <CopyButton
                  text={c.command_text}
                  label={`Copy ${c.title}`}
                  warning={copyWarning(c)}
                  className="m-1"
                />
              </div>

              {c.prerequisites ? (
                <p
                  className={cn(
                    "flex items-start gap-1.5 text-xs whitespace-pre-wrap",
                    c.is_destructive ? "text-status-blocked" : "text-muted-foreground",
                  )}
                >
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium">Before you run it: </span>
                    {c.prerequisites}
                  </span>
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      {editing ? (
        <CommandDialog
          command={editing}
          options={options}
          projectId={projectId}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved command is removed. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const target = deleting
                if (!target) return
                startTransition(async () => {
                  const r = await deleteCommand(target.id)
                  if (r.ok) {
                    toast.success("Command deleted")
                    setDeleting(null)
                  } else toast.error(r.error)
                })
              }}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Delete command
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* Create / edit ---------------------------------------------------------------- */

export function CommandDialogButton({
  options,
  projectId,
  variant = "default",
}: {
  options: LinkOptions
  projectId?: string
  variant?: "default" | "outline"
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Plus />
        New command
      </Button>
      {open ? (
        <CommandDialog options={options} projectId={projectId} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}

function CommandDialog({
  command,
  options,
  projectId,
  onClose,
}: {
  command?: CommandRow
  options: LinkOptions
  projectId?: string
  onClose: () => void
}) {
  const [title, setTitle] = React.useState(command?.title ?? "")
  const [text, setText] = React.useState(command?.command_text ?? "")
  const [destructive, setDestructive] = React.useState(command?.is_destructive ?? false)
  const [links, setLinks] = React.useState<LinkValue>({
    project_id: command ? command.project_id : (projectId ?? null),
    repository_id: command?.repository_id ?? null,
    environment_id: command?.environment_id ?? null,
  })
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = await saveCommand(command?.id ?? null, prev, formData)
      if (r.status === "success") {
        toast.success(r.message ?? "Saved")
        onClose()
      }
      return r
    },
    initialFormState,
  )
  const err = (k: string) => toFieldErrors(state.fieldErrors?.[k])
  // Fold the extras unless one is filled in or has an error (Plan P10.4).
  const hasMore =
    Boolean(
      command &&
      (command.shell !== "bash" ||
        command.operating_system !== "cross_platform" ||
        command.category !== "other" ||
        command.repository_id ||
        command.environment_id ||
        command.description ||
        command.prerequisites ||
        (!projectId && command.project_id)),
    ) ||
    ["description", "prerequisites", "project_id", "repository_id", "environment_id"].some((k) =>
      Boolean(state.fieldErrors?.[k]),
    )
  const secretWarning = secretMessage(text)
  const reasons = destructiveReasons(text)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => dispatch(data))
          }}
        >
          <DialogHeader>
            <DialogTitle>{command ? "Edit command" : "New command"}</DialogTitle>
            <DialogDescription>
              Saved to copy later. DevWorkspace never runs commands. Use placeholders like
              $DATABASE_URL instead of secrets.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.title)}>
              <FieldLabel htmlFor="cmd-title">Title</FieldLabel>
              <Input
                id="cmd-title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                placeholder="e.g. Apply migrations to dev"
                aria-invalid={Boolean(state.fieldErrors?.title)}
                autoFocus={!command}
              />
              <FieldError errors={err("title")} />
            </Field>

            <Field data-invalid={Boolean(state.fieldErrors?.command_text || secretWarning)}>
              <FieldLabel htmlFor="cmd-text">Command</FieldLabel>
              <Textarea
                id="cmd-text"
                name="command_text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                maxLength={10000}
                spellCheck={false}
                autoComplete="off"
                placeholder="pnpm db:push --yes"
                className="font-mono text-xs"
                aria-invalid={Boolean(state.fieldErrors?.command_text || secretWarning)}
                aria-describedby="cmd-text-help"
              />
              <div id="cmd-text-help" className="flex flex-col gap-2">
                {secretWarning ? (
                  <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {secretWarning}
                  </p>
                ) : null}
                {reasons.length && !destructive ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-status-blocked/30 bg-status-blocked/5 px-2.5 py-1.5 text-sm">
                    <TriangleAlert className="size-3.5 shrink-0 text-status-blocked" aria-hidden />
                    <span className="min-w-0 flex-1">
                      This looks destructive ({reasons.join(", ")}).
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDestructive(true)}
                    >
                      Mark as destructive
                    </Button>
                  </div>
                ) : null}
              </div>
              <FieldError errors={err("command_text")} />
            </Field>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cmd-destructive"
                  name="is_destructive"
                  checked={destructive}
                  onCheckedChange={(v) => setDestructive(v === true)}
                />
                <Label htmlFor="cmd-destructive" className="font-normal">
                  Destructive (deletes or overwrites data)
                </Label>
              </div>
              <FieldDescription>Shown as a warning wherever the command appears.</FieldDescription>
            </div>

            <MoreDetails open={hasMore} hint="shell, project links, description">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="cmd-shell">Shell</FieldLabel>
                  <Select name="shell" defaultValue={command?.shell ?? "bash"}>
                    <SelectTrigger id="cmd-shell" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMAND_SHELLS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {COMMAND_SHELL_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="cmd-os">Operating system</FieldLabel>
                  <Select
                    name="operating_system"
                    defaultValue={command?.operating_system ?? "cross_platform"}
                  >
                    <SelectTrigger id="cmd-os" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMAND_OSES.map((o) => (
                        <SelectItem key={o} value={o}>
                          {COMMAND_OS_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="cmd-category">Category</FieldLabel>
                  <Select name="category" defaultValue={command?.category ?? "other"}>
                    <SelectTrigger id="cmd-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMAND_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {COMMAND_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <LinkFields
                idPrefix="cmd"
                options={options}
                value={links}
                onChange={setLinks}
                fixedProject={Boolean(projectId)}
                errors={state.fieldErrors}
              />

              <Field data-invalid={Boolean(state.fieldErrors?.description)}>
                <FieldLabel htmlFor="cmd-description">Description</FieldLabel>
                <Textarea
                  id="cmd-description"
                  name="description"
                  defaultValue={command?.description ?? ""}
                  rows={2}
                  maxLength={2000}
                  placeholder="What it does and when to use it"
                />
                <FieldError errors={err("description")} />
              </Field>

              <Field data-invalid={Boolean(state.fieldErrors?.prerequisites)}>
                <FieldLabel htmlFor="cmd-prereq">Prerequisites and warnings</FieldLabel>
                <Textarea
                  id="cmd-prereq"
                  name="prerequisites"
                  defaultValue={command?.prerequisites ?? ""}
                  rows={2}
                  maxLength={2000}
                  placeholder="e.g. Run from the repo root. Needs SUPABASE_ACCESS_TOKEN set."
                />
                <FieldError errors={err("prerequisites")} />
              </Field>
            </MoreDetails>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {command ? "Save command" : "Add command"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
