"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Copy, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, Trash2, Wand2 } from "lucide-react"
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
} from "@/components/ui/alert-dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormMessage } from "@/features/auth/components/form-message"
import { formatDateTime } from "@/lib/format"
import { offlineResult, whenOnline } from "@/lib/offline/guard"
import { addSecret, deleteSecret, updateSecret } from "../actions"
import { revealSecret, sealSecret } from "../client"
import { copySecretValue, CLEAR_MS } from "../clipboard"
import { generatePassword } from "../crypto"
import {
  ACCOUNT_SECRET_KIND_LABELS,
  ACCOUNT_SECRET_KINDS,
  type AccountSecretKind,
} from "../schemas"
import { useVaultUnlocked } from "../store"
import { SecretInput } from "./secret-input"
import { SetupVaultDialog } from "./setup-vault-dialog"
import { UnlockVaultDialog } from "./unlock-dialog"

type SecretMeta = { id: string; label: string; kind: AccountSecretKind; value_updated_at: string }
type Editing = { id: string; label: string; kind: AccountSecretKind; value: string; isNew: boolean }

const HIDE_MS = 30_000

function without(values: Record<string, string>, id: string) {
  const next = { ...values }
  delete next[id]
  return next
}

/**
 * An account's stored secrets (Plan P11.4–P11.5). Only labels come from the server; a value is
 * fetched as ciphertext and decrypted in the browser when you reveal, copy or edit it.
 */
export function SecretsPanel({
  accountId,
  secrets,
  hasVault,
  timeZone,
}: {
  accountId: string
  secrets: SecretMeta[]
  hasVault: boolean
  timeZone: string
}) {
  const router = useRouter()
  const unlocked = useVaultUnlocked()
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const [setupOpen, setSetupOpen] = React.useState(false)
  const [revealedValues, setRevealed] = React.useState<Record<string, string>>({})
  // Locking hides every revealed value at once.
  const revealed = unlocked ? revealedValues : {}
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<Editing | null>(null)
  const [deleting, setDeleting] = React.useState<SecretMeta | null>(null)
  const afterUnlock = React.useRef<(() => void) | null>(null)
  const timers = React.useRef(new Map<string, number>())

  React.useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])

  function withUnlock(run: () => void) {
    if (unlocked) run()
    else {
      afterUnlock.current = run
      setUnlockOpen(true)
    }
  }

  async function reveal(s: SecretMeta) {
    if (revealed[s.id] !== undefined) {
      setRevealed((r) => without(r, s.id))
      return
    }
    setBusyId(s.id)
    try {
      const value = await revealSecret(s.id, accountId)
      setRevealed((r) => ({ ...r, [s.id]: value }))
      window.clearTimeout(timers.current.get(s.id))
      timers.current.set(
        s.id,
        window.setTimeout(() => setRevealed((r) => without(r, s.id)), HIDE_MS),
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't show that value.")
    } finally {
      setBusyId(null)
    }
  }

  async function copy(s: SecretMeta) {
    try {
      await copySecretValue(revealSecret(s.id, accountId))
      toast.success(`${s.label} copied`, {
        description: `Cleared from the clipboard in ${CLEAR_MS / 1000} seconds.`,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't copy that value.")
    }
  }

  async function edit(s: SecretMeta) {
    setBusyId(s.id)
    try {
      const value = await revealSecret(s.id, accountId)
      setEditing({ id: s.id, label: s.label, kind: s.kind, value, isNew: false })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open that value.")
    } finally {
      setBusyId(null)
    }
  }

  if (!hasVault) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 text-sm">
        <p className="text-muted-foreground">
          Set up the vault to keep this account&apos;s passwords and API keys here, encrypted.
        </p>
        <Button size="sm" className="w-fit" onClick={() => setSetupOpen(true)}>
          Set up vault
        </Button>
        <SetupVaultDialog open={setupOpen} onOpenChange={setSetupOpen} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {secrets.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Nothing stored yet. Add the password, API keys or recovery codes for this account.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {secrets.map((s) => {
            const value = revealed[s.id]
            return (
              <li
                key={s.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {s.label}
                    <span className="text-xs font-normal text-muted-foreground">
                      {ACCOUNT_SECRET_KIND_LABELS[s.kind]}
                    </span>
                  </span>
                  {value !== undefined ? (
                    <code
                      className="rounded bg-muted px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap"
                      aria-label={`${s.label} value`}
                    >
                      {value || "(empty)"}
                    </code>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Changed {formatDateTime(s.value_updated_at, timeZone)}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === s.id}
                    onClick={() => withUnlock(() => void reveal(s))}
                    aria-label={value !== undefined ? `Hide ${s.label}` : `Show ${s.label}`}
                  >
                    {busyId === s.id ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : value !== undefined ? (
                      <EyeOff />
                    ) : (
                      <Eye />
                    )}
                    <span className="hidden sm:inline">
                      {value !== undefined ? "Hide" : "Show"}
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => withUnlock(() => void copy(s))}
                    aria-label={`Copy ${s.label}`}
                  >
                    <Copy />
                    <span className="hidden sm:inline">Copy</span>
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => withUnlock(() => void edit(s))}
                    aria-label={`Edit ${s.label}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setDeleting(s)}
                    aria-label={`Delete ${s.label}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() =>
          withUnlock(() =>
            setEditing({
              id: crypto.randomUUID(),
              label: secrets.some((s) => s.kind === "password") ? "" : "Password",
              kind: "password",
              value: "",
              isNew: true,
            }),
          )
        }
      >
        <Plus />
        Add a password or key
      </Button>

      <UnlockVaultDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => {
          const run = afterUnlock.current
          afterUnlock.current = null
          run?.()
        }}
      />

      {editing ? (
        <SecretDialog
          accountId={accountId}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setRevealed((r) => without(r, editing.id))
            setEditing(null)
            router.refresh()
          }}
        />
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The stored value is deleted for good. Make sure you have it somewhere else if you
              still need it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return
                const r = await whenOnline(
                  () => deleteSecret({ secretId: deleting.id, accountId }),
                  offlineResult,
                )
                if (r.ok) {
                  toast.success(`${deleting.label} deleted`)
                  router.refresh()
                } else toast.error(r.error)
                setDeleting(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SecretDialog({
  accountId,
  initial,
  onClose,
  onSaved,
}: {
  accountId: string
  initial: Editing
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = React.useState(initial.label)
  const [kind, setKind] = React.useState<AccountSecretKind>(initial.kind)
  const [value, setValue] = React.useState(initial.value)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const multiline = kind === "note" || kind === "recovery_codes"

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!label.trim()) {
      setError("Give it a label, e.g. Password or API key (production).")
      return
    }
    setBusy(true)
    try {
      const sealed = await sealSecret(initial.id, accountId, value)
      const input = { id: initial.id, accountId, label: label.trim(), kind, ...sealed }
      const r = await whenOnline(
        () => (initial.isNew ? addSecret(input) : updateSecret(input)),
        offlineResult,
      )
      if (!r.ok) {
        setError(r.error)
        return
      }
      toast.success(initial.isNew ? "Saved to the vault" : "Saved")
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="flex flex-col gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>
              {initial.isNew ? "Add to the vault" : `Edit ${initial.label}`}
            </DialogTitle>
            <DialogDescription>
              The value is encrypted on this device before it is saved.
            </DialogDescription>
          </DialogHeader>
          {error ? <FormMessage status="error">{error}</FormMessage> : null}
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="secret-label">Label</FieldLabel>
                <Input
                  id="secret-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={80}
                  placeholder="API key (production)"
                  autoComplete="off"
                  autoFocus={initial.isNew}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="secret-kind">Kind</FieldLabel>
                <Select value={kind} onValueChange={(v) => setKind(v as AccountSecretKind)}>
                  <SelectTrigger id="secret-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_SECRET_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {ACCOUNT_SECRET_KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="secret-value">Value</FieldLabel>
              {multiline ? (
                <Textarea
                  id="secret-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  className="font-mono text-xs"
                />
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <SecretInput
                    id="secret-value"
                    value={value}
                    onChange={setValue}
                    reveal
                    className="flex-1"
                  />
                  {kind === "password" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setValue(generatePassword(24))}
                    >
                      <Wand2 />
                      Generate
                    </Button>
                  ) : null}
                </div>
              )}
              <FieldDescription>
                Up to 16 KB. Only you can read it, after unlocking.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
