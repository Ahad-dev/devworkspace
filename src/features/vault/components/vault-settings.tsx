"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Copy, KeyRound, Loader2, RotateCcw, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { FormMessage } from "@/features/auth/components/form-message"
import { offlineResult, whenOnline } from "@/lib/offline/guard"
import { resetVault, updateVaultMaster, updateVaultRecovery } from "../actions"
import { fetchVaultRecord } from "../client"
import {
  MIN_MASTER_PASSWORD_LENGTH,
  unlockWithPassword,
  wrapWithNewRecoveryKey,
  wrapWithPassword,
} from "../crypto"
import { lockVault } from "../store"
import { SecretInput } from "./secret-input"

type Mode = "password" | "recovery" | "reset" | null

/**
 * Settings → Password vault (Plan P11.3): change the master password, make a new recovery key, or
 * reset the vault. Each asks for the current master password; only re-wrapped keys leave the device.
 */
export function VaultSettings({ hasVault }: { hasVault: boolean }) {
  const [mode, setMode] = React.useState<Mode>(null)
  if (!hasVault) {
    return (
      <p className="text-sm text-muted-foreground">
        Not set up yet. Set it up from{" "}
        <Link href="/accounts" className="underline underline-offset-4">
          Accounts
        </Link>
        .
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Your master password and recovery key never leave this device. DevWorkspace can&apos;t reset
        them for you.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setMode("password")}>
          <KeyRound />
          Change master password
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode("recovery")}>
          <RotateCcw />
          New recovery key
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode("reset")}>
          <Trash2 />
          Reset vault
        </Button>
      </div>
      {mode ? <VaultSettingsDialog mode={mode} onClose={() => setMode(null)} /> : null}
    </div>
  )
}

function VaultSettingsDialog({ mode, onClose }: { mode: NonNullable<Mode>; onClose: () => void }) {
  const router = useRouter()
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [typed, setTyped] = React.useState("")
  const [newKey, setNewKey] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const copy = {
    password: {
      title: "Change master password",
      text: "Stored values stay as they are; only the way the vault opens changes.",
    },
    recovery: {
      title: "New recovery key",
      text: "The old recovery key stops working. Save the new one somewhere safe and offline.",
    },
    reset: {
      title: "Reset the vault",
      text: "Every stored password and key is deleted for good. Accounts and their logins stay. Use this only if you lost both the master password and the recovery key.",
    },
  }[mode]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === "reset") {
        if (typed !== "RESET") throw new Error("Type RESET to confirm.")
        const r = await whenOnline(() => resetVault({ confirm: typed }), offlineResult)
        if (!r.ok) throw new Error(r.error)
        lockVault()
        toast.success("Vault reset")
        onClose()
        router.refresh()
        return
      }
      const record = await fetchVaultRecord()
      if (!record) throw new Error("There is no vault yet.")
      const key = await unlockWithPassword(record.owner_id, record, current, { extractable: true })
      if (mode === "password") {
        if (next.length < MIN_MASTER_PASSWORD_LENGTH) {
          throw new Error(`Use at least ${MIN_MASTER_PASSWORD_LENGTH} characters.`)
        }
        if (next !== confirm) throw new Error("The new passwords don't match.")
        const r = await whenOnline(
          async () => updateVaultMaster(await wrapWithPassword(record.owner_id, key, next)),
          offlineResult,
        )
        if (!r.ok) throw new Error(r.error)
        toast.success("Master password changed")
        onClose()
      } else {
        const fresh = await wrapWithNewRecoveryKey(record.owner_id, key)
        const r = await whenOnline(() => updateVaultRecovery(fresh.fields), offlineResult)
        if (!r.ok) throw new Error(r.error)
        setNewKey(fresh.recoveryKey)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {newKey ? (
          <div className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Your new recovery key</DialogTitle>
              <DialogDescription>Shown only now. The old one no longer works.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
              <p className="font-mono text-sm break-all" aria-label="Recovery key">
                {newKey}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={async () => {
                  await navigator.clipboard.writeText(newKey)
                  setCopied(true)
                }}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>I&apos;ve saved it</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.text}</DialogDescription>
            </DialogHeader>
            {error ? <FormMessage status="error">{error}</FormMessage> : null}
            <FieldGroup>
              {mode === "reset" ? (
                <Field>
                  <FieldLabel htmlFor="vault-reset-confirm">Type RESET to confirm</FieldLabel>
                  <Input
                    id="vault-reset-confirm"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="vault-current">Current master password</FieldLabel>
                  <SecretInput id="vault-current" value={current} onChange={setCurrent} autoFocus />
                </Field>
              )}
              {mode === "password" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="vault-next">New master password</FieldLabel>
                    <SecretInput id="vault-next" value={next} onChange={setNext} reveal />
                    <FieldDescription>
                      At least {MIN_MASTER_PASSWORD_LENGTH} characters; not your sign-in password.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="vault-next-confirm">Repeat it</FieldLabel>
                    <SecretInput id="vault-next-confirm" value={confirm} onChange={setConfirm} />
                  </Field>
                </>
              ) : null}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={mode === "reset" ? "destructive" : "default"}
                disabled={busy || (mode === "reset" ? typed !== "RESET" : !current)}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {mode === "reset" ? "Reset vault" : mode === "recovery" ? "Make new key" : "Change"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
