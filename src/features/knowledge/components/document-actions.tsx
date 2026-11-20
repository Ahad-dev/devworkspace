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
import { deleteDocument, setDocumentArchived } from "../actions"

/** Edit / archive / restore / delete for one document (Spec FR-10: archive keeps history). */
export function DocumentActions({
  documentId,
  title,
  archived,
  attachmentCount,
}: {
  documentId: string
  title: string
  archived: boolean
  attachmentCount: number
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [deleteState, deleteAction, deleting] = React.useActionState(
    () => deleteDocument(documentId),
    initialFormState,
  )

  function setArchived(next: boolean) {
    startTransition(async () => {
      const r = await setDocumentArchived(documentId, next)
      if (r.ok) toast.success(next ? "Document archived" : "Document restored")
      else toast.error(r.error)
    })
  }

  return (
    <div className="flex items-center gap-2">
      {!archived ? (
        <Button asChild size="sm">
          <Link href={`/knowledge/documents/${documentId}/edit`}>
            <Pencil />
            Edit
          </Link>
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setArchived(false)}>
          <ArchiveRestore />
          Restore
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More document actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {archived ? (
            <DropdownMenuItem disabled={pending} onSelect={() => setArchived(false)}>
              <ArchiveRestore />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pending} onSelect={() => setArchived(true)}>
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
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the document
              {attachmentCount
                ? ` and its ${attachmentCount} attached file${attachmentCount === 1 ? "" : "s"}`
                : ""}
              . It can&apos;t be undone. {!archived ? "To keep it, archive it instead." : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.status === "error" && deleteState.message ? (
            <FormMessage status="error">{deleteState.message}</FormMessage>
          ) : null}
          {/* Redirecting action: submitted through the form action. */}
          <form action={deleteAction}>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Delete document
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
