"use client"

import * as React from "react"
import Link from "next/link"
import {
  Archive,
  ArchiveRestore,
  Loader2,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormMessage } from "@/features/auth/components/form-message"
import { initialFormState } from "@/features/projects/schemas"
import { deleteEnvironment, markEnvironmentReviewed, setEnvironmentArchived } from "../actions"

/**
 * Edit / mark reviewed / archive / restore / delete (Spec FR-08 safety UX). Deleting a production
 * environment requires typing its name; the server checks it again.
 */
export function EnvironmentActions({
  environmentId,
  name,
  production,
  archived,
  counts,
}: {
  environmentId: string
  name: string
  production: boolean
  archived: boolean
  counts: { variables: number; services: number }
}) {
  const [pending, startTransition] = React.useTransition()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [typed, setTyped] = React.useState("")
  const [deleteState, deleteAction, deleting] = React.useActionState(
    deleteEnvironment.bind(null, environmentId),
    initialFormState,
  )

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const r = await fn()
      if (r.ok) toast.success(done)
      else toast.error((r as { error: string }).error)
    })
  }

  const what = [
    counts.variables && `${counts.variables} variable${counts.variables === 1 ? "" : "s"}`,
    counts.services && `${counts.services} service link${counts.services === 1 ? "" : "s"}`,
  ].filter(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!archived ? (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => markEnvironmentReviewed(environmentId), "Marked reviewed")}
          >
            <ShieldCheck />
            Mark reviewed
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/environments/${environmentId}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => setEnvironmentArchived(environmentId, false), "Environment restored")
          }
        >
          <ArchiveRestore />
          Restore
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More environment actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {!archived ? (
            <>
              <DropdownMenuItem
                disabled={pending}
                onSelect={() =>
                  run(() => setEnvironmentArchived(environmentId, true), "Environment archived")
                }
              >
                <Archive />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o)
          if (!o) setTyped("")
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the environment
              {what.length ? ` with its ${what.join(" and ")}` : ""}. It can&apos;t be undone.
              Archive it instead to keep the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.status === "error" && deleteState.message ? (
            <FormMessage status="error">{deleteState.message}</FormMessage>
          ) : null}
          <form action={deleteAction} className="flex flex-col gap-4">
            {production ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-name">
                  This is a production environment. Type <span className="font-mono">{name}</span>{" "}
                  to confirm.
                </Label>
                <Input
                  id="confirm-name"
                  name="confirm_name"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  aria-invalid={Boolean(deleteState.fieldErrors?.confirm_name)}
                />
                {deleteState.fieldErrors?.confirm_name ? (
                  <p role="alert" className="text-sm text-destructive">
                    {deleteState.fieldErrors.confirm_name[0]}
                  </p>
                ) : null}
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || (production && typed.trim() !== name)}
              >
                {deleting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Delete environment
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
