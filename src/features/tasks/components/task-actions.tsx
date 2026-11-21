"use client"

import * as React from "react"
import Link from "next/link"
import { Archive, ArchiveRestore, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

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
import { initialFormState } from "@/features/projects/schemas"
import { deleteTask, setTaskArchived } from "../actions"
import { offlineFormState, offlineResult, whenOnline } from "@/lib/offline/guard"

/** Edit / archive / restore / delete (Spec FR-06: archive preferred, delete confirmed). */
export function TaskActions({
  taskId,
  taskTitle,
  archived,
  subtaskCount,
}: {
  taskId: string
  taskTitle: string
  archived: boolean
  subtaskCount: number
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  // Redirecting action: submitted from a form (see ProjectActions).
  const [deleteState, deleteAction, deleting] = React.useActionState(
    () => whenOnline(() => deleteTask(taskId), offlineFormState),
    initialFormState,
  )

  function archive(next: boolean) {
    startTransition(async () => {
      const r = await whenOnline(() => setTaskArchived(taskId, next), offlineResult)
      if (r.ok) toast.success(next ? "Task archived" : "Task restored")
      else toast.error(r.error)
    })
  }

  return (
    <div className="flex items-center gap-2">
      {archived ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => archive(false)}>
          <ArchiveRestore />
          Restore
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={`/tasks/${taskId}/edit`}>
            <Pencil />
            Edit
          </Link>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More task actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {!archived ? (
            <DropdownMenuItem disabled={pending} onSelect={() => archive(true)}>
              <Archive />
              Archive
            </DropdownMenuItem>
          ) : null}
          {!archived ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{taskTitle}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the task with its comments, labels, links, dependency links,
              work sessions and handoffs. It can&apos;t be undone.{" "}
              {subtaskCount
                ? `It has ${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}: delete or move them first.`
                : null}{" "}
              {!archived ? "To keep its history, archive it instead." : null}
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
                Delete task
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
