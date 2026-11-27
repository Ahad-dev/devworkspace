"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Download, Loader2, ShieldCheck } from "lucide-react"
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
import { createClient } from "@/lib/supabase/client"
import { createVaultRecord } from "../actions"
import { createVault, MIN_MASTER_PASSWORD_LENGTH, type VaultKeyRecord } from "../crypto"
import { unlockVault } from "../store"
import { SecretInput } from "./secret-input"

type Prepared = { ownerId: string; record: VaultKeyRecord; recoveryKey: string; key: CryptoKey }

/**
 * Sets up the vault (Plan P11.3): choose a master password, then save the recovery key. Nothing is
 * stored until the recovery key is confirmed, so closing half-way leaves no vault behind.
 */
export function SetupVaultDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [prepared, setPrepared] = React.useState<Prepared | null>(null)
  const [lastGroup, setLastGroup] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  function close(o: boolean) {
    if (!o) {
      setPassword("")
      setConfirm("")
      setPrepared(null)
      setLastGroup("")
      setError(null)
      setCopied(false)
    }
    onOpenChange(o)
  }

  async function prepare(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_MASTER_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_MASTER_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("The passwords don't match.")
      return
    }
    setBusy(true)
    try {
      const { data } = await createClient().auth.getUser()
      if (!data.user) throw new Error("Sign in again to set up the vault.")
      const vault = await createVault(data.user.id, password)
      setPrepared({
        ownerId: data.user.id,
        record: vault.record,
        recoveryKey: vault.recoveryKey,
        key: vault.sessionKey,
      })
      setPassword("")
      setConfirm("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't prepare the vault.")
    } finally {
      setBusy(false)
    }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault()
    if (!prepared) return
    const expected = prepared.recoveryKey.split("-").at(-1) ?? ""
    if (lastGroup.trim().toUpperCase() !== expected) {
      setError("That isn't the last group of your recovery key. Check what you saved.")
      return
    }
    setBusy(true)
    setError(null)
    const saved = await createVaultRecord(prepared.record)
    setBusy(false)
    if (!saved.ok) {
      setError(saved.error)
      return
    }
    unlockVault(prepared.key, prepared.ownerId)
    toast.success("Vault ready and unlocked")
    close(false)
    router.refresh()
  }

  function download() {
    if (!prepared) return
    const text = `DevWorkspace vault recovery key\n\n${prepared.recoveryKey}\n\nKeep this somewhere safe and offline. With it you can open your vault if you forget the master password.\n`
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "devworkspace-recovery-key.txt"
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 5_000)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        {!prepared ? (
          <form onSubmit={prepare} className="flex flex-col gap-6" noValidate>
            <DialogHeader>
              <DialogTitle>Set up your password vault</DialogTitle>
              <DialogDescription>
                Passwords and API keys you store are encrypted on this device with your master
                password before they are saved. DevWorkspace never sees them, and can&apos;t reset
                the master password for you.
              </DialogDescription>
            </DialogHeader>
            {error ? <FormMessage status="error">{error}</FormMessage> : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="setup-master">Master password</FieldLabel>
                <SecretInput
                  id="setup-master"
                  value={password}
                  onChange={setPassword}
                  reveal
                  autoFocus
                />
                <FieldDescription>
                  At least {MIN_MASTER_PASSWORD_LENGTH} characters. Use one you use nowhere else,
                  and not your DevWorkspace sign-in password. A few random words work well.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="setup-master-confirm">Repeat it</FieldLabel>
                <SecretInput id="setup-master-confirm" value={confirm} onChange={setConfirm} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !password}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Continue
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={finish} className="flex flex-col gap-6" noValidate>
            <DialogHeader>
              <DialogTitle>Save your recovery key</DialogTitle>
              <DialogDescription>
                It is shown only now. If you forget the master password, this key is the only way
                into the vault. Print it or keep it offline, not in DevWorkspace.
              </DialogDescription>
            </DialogHeader>
            {error ? <FormMessage status="error">{error}</FormMessage> : null}
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
              <p
                className="font-mono text-sm leading-relaxed tracking-wide break-all"
                aria-label="Recovery key"
              >
                {prepared.recoveryKey}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(prepared.recoveryKey)
                    setCopied(true)
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={download}>
                  <Download />
                  Download as a file
                </Button>
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor="setup-last-group">
                To confirm you saved it, type its last group
              </FieldLabel>
              <Input
                id="setup-last-group"
                value={lastGroup}
                onChange={(e) => setLastGroup(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="w-40 font-mono uppercase"
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !lastGroup.trim()}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck />}
                Create vault
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
