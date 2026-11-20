"use client"

import * as React from "react"
import Link from "next/link"
import { Archive, ArchiveRestore, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FormMessage } from "@/features/auth/components/form-message"
import { archiveProject, deleteProject, restoreProject } from "../actions"
import { initialFormState } from "../schemas"

/** Edit / archive / restore / delete (Spec FR-03 lifecycle: archive preferred, delete confirmed). */
export function ProjectActions({
  projectId,
  projectName,
  archived,
  counts,
}: {
  projectId: string
  projectName: string
  archived: boolean
  counts: { repositories: number; technologies: number; tasks?: number }
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  // A form + useActionState, like the other redirecting actions: a redirect from an action
  // awaited inside an onClick transition left the navigation pending.
  const [deleteState, deleteAction, deleting] = React.useActionState(
    deleteProject.bind(null, projectId),
    initialFormState,
  )

  const children = [
    counts.tasks && `${counts.tasks} task${counts.tasks === 1 ? "" : "s"}`,
    counts.repositories &&
      `${counts.repositories} repositor${counts.repositories === 1 ? "y" : "ies"}`,
    counts.technologies &&
      `${counts.technologies} technolog${counts.technologies === 1 ? "y" : "ies"}`,
  ].filter(Boolean)

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/projects/${projectId}/edit`}>
          <Pencil />
          Edit
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More project actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {archived ? (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => startTransition(() => restoreProject(projectId))}
            >
              <ArchiveRestore />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => startTransition(() => archiveProject(projectId))}
            >
              <Archive />
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {projectName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project
              {children.length ? ` and its ${children.join(" and ")}` : ""}. It can&apos;t be
              undone. Its activity history is kept as a deletion record.{" "}
              {!archived ? "To keep everything, archive it instead." : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.status === "error" && deleteState.message ? (
            <FormMessage status="error">{deleteState.message}</FormMessage>
          ) : null}
          <form action={deleteAction}>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Delete project
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
