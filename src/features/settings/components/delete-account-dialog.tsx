"use client"

import * as React from "react"
import { Loader2, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState } from "@/features/projects/schemas"
import { deleteAccount } from "../actions"

/**
 * Account deletion (Spec §9.6; Plan P8.1): explains exactly what goes, then needs DELETE typed and
 * the password re-entered. The server verifies the password before removing anything.
 */
export function DeleteAccountDialog({ available }: { available: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [state, formAction, pending] = React.useActionState(deleteAccount, initialFormState)

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Deletes your account and everything in it: projects, tasks, sessions and handoffs,
        environments, services, variable names and secret references, documents with their attached
        files, commands and activity. It can&apos;t be undone. Download your data first. Secrets in
        your external vaults are not touched.
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) {
            setConfirm("")
            setPassword("")
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-fit" disabled={!available}>
            <Trash2 />
            Delete account…
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          {/* Redirecting action: submitted through the form action. */}
          <form action={formAction} className="flex flex-col gap-5" noValidate>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything you stored in DevWorkspace is permanently deleted, including uploaded
                files. Your vault secrets stay where they are.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {state.status === "error" && state.message ? (
              <FormMessage status="error">{state.message}</FormMessage>
            ) : null}
            <FieldGroup>
              <Field data-invalid={Boolean(state.fieldErrors?.confirm)}>
                <FieldLabel htmlFor="delete-confirm">Type DELETE to confirm</FieldLabel>
                <Input
                  id="delete-confirm"
                  name="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  aria-invalid={Boolean(state.fieldErrors?.confirm)}
                />
                <FieldError errors={toFieldErrors(state.fieldErrors?.confirm)} />
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.password)}>
                <FieldLabel htmlFor="delete-password">Your password</FieldLabel>
                <Input
                  id="delete-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={Boolean(state.fieldErrors?.password)}
                />
                <FieldError errors={toFieldErrors(state.fieldErrors?.password)} />
              </Field>
            </FieldGroup>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || confirm !== "DELETE" || !password}
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Delete account
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {!available ? (
        <p className="text-xs text-muted-foreground">
          Not available on this server yet: it needs the server-only Supabase key.
        </p>
      ) : null}
    </div>
  )
}
