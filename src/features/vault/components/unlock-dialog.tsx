"use client"

import * as React from "react"
import { Loader2, LockKeyholeOpen } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { FormMessage } from "@/features/auth/components/form-message"
import { updateVaultMaster } from "../actions"
import { fetchVaultRecord, unlockVaultWithPassword } from "../client"
import {
  MIN_MASTER_PASSWORD_LENGTH,
  unlockWithRecoveryKey,
  VaultError,
  wrapWithPassword,
} from "../crypto"
import { unlockVault } from "../store"
import { SecretInput } from "./secret-input"

/**
 * Unlocks the vault with the master password, or, if it's forgotten, with the recovery key plus a
 * new master password (Plan P11.3). Everything happens in the browser: only the re-wrapped key is
 * sent to the server.
 */
export function UnlockVaultDialog({
  open,
  onOpenChange,
  onUnlocked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnlocked?: () => void
}) {
  const [mode, setMode] = React.useState<"password" | "recovery">("password")
  const [password, setPassword] = React.useState("")
  const [recovery, setRecovery] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  function close(o: boolean) {
    if (!o) {
      setPassword("")
      setRecovery("")
      setNext("")
      setConfirm("")
      setError(null)
      setMode("password")
    }
    onOpenChange(o)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === "password") {
        await unlockVaultWithPassword(password)
      } else {
        if (next.length < MIN_MASTER_PASSWORD_LENGTH) {
          throw new VaultError(
            "wrong_password",
            `Use at least ${MIN_MASTER_PASSWORD_LENGTH} characters for the new master password.`,
          )
        }
        if (next !== confirm)
          throw new VaultError("wrong_password", "The new passwords don't match.")
        const record = await fetchVaultRecord()
        if (!record) throw new Error("There is no vault yet.")
        const extractable = await unlockWithRecoveryKey(record.owner_id, record, recovery, {
          extractable: true,
        })
        const fields = await wrapWithPassword(record.owner_id, extractable, next)
        const saved = await updateVaultMaster(fields)
        if (!saved.ok) throw new Error(saved.error)
        unlockVault(await unlockWithRecoveryKey(record.owner_id, record, recovery), record.owner_id)
        toast.success("New master password set")
      }
      close(false)
      onUnlocked?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unlock the vault.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>
              {mode === "password" ? "Unlock the vault" : "Use your recovery key"}
            </DialogTitle>
            <DialogDescription>
              {mode === "password"
                ? "Your master password opens it on this device only. It locks again after 15 minutes without use."
                : "Enter the recovery key you saved when you set up the vault, then choose a new master password."}
            </DialogDescription>
          </DialogHeader>

          {error ? <FormMessage status="error">{error}</FormMessage> : null}

          <FieldGroup>
            {mode === "password" ? (
              <Field>
                <FieldLabel htmlFor="vault-master">Master password</FieldLabel>
                <SecretInput id="vault-master" value={password} onChange={setPassword} autoFocus />
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="vault-recovery">Recovery key</FieldLabel>
                  <SecretInput
                    id="vault-recovery"
                    value={recovery}
                    onChange={setRecovery}
                    reveal
                    autoFocus
                    placeholder="XXXXXX-XXXXXX-…"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="vault-new-master">New master password</FieldLabel>
                  <SecretInput id="vault-new-master" value={next} onChange={setNext} reveal />
                  <FieldDescription>
                    At least {MIN_MASTER_PASSWORD_LENGTH} characters. Not your DevWorkspace sign-in
                    password.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="vault-new-master-confirm">Repeat it</FieldLabel>
                  <SecretInput
                    id="vault-new-master-confirm"
                    value={confirm}
                    onChange={setConfirm}
                  />
                </Field>
              </>
            )}
          </FieldGroup>

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="link"
              className="px-0"
              onClick={() => {
                setError(null)
                setMode(mode === "password" ? "recovery" : "password")
              }}
            >
              {mode === "password" ? "Forgot it? Use the recovery key" : "Use the master password"}
            </Button>
            <Button type="submit" disabled={busy || (mode === "password" ? !password : !recovery)}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <LockKeyholeOpen />}
              Unlock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
