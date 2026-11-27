"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { offlineFormState, whenOnline } from "@/lib/offline/guard"
import { deleteAccount } from "../actions"

/** Deletes an account and everything stored for it; linked services keep running, unlinked. */
export function DeleteAccountButton({ accountId, name }: { accountId: string; name: string }) {
  const [pending, startTransition] = React.useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The account and every password and key stored for it are deleted for good. Services that
            used it stay in their projects, without an account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await whenOnline(() => deleteAccount({ accountId }), offlineFormState)
                if (r?.status === "error") toast.error(r.message ?? "Couldn't delete the account.")
              })
            }
          >
            Delete account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
