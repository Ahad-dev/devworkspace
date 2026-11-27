"use client"

import * as React from "react"
import Link from "next/link"
import { Copy, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { revealSecret } from "../client"
import { copySecretValue, CLEAR_MS } from "../clipboard"
import { useVaultUnlocked } from "../store"
import { UnlockVaultDialog } from "./unlock-dialog"

const HIDE_MS = 30_000

export type VaultItemRef = { id: string; accountId: string; label: string; account: string }

/**
 * Where a variable's value is kept in the vault, with Show and Copy (Plan P12.3). Only the item's
 * labels come from the server; the value is fetched as ciphertext and decrypted here on request.
 */
export function VaultItemValue({ item, name }: { item: VaultItemRef; name: string }) {
  const unlocked = useVaultUnlocked()
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const [value, setValue] = React.useState<string | null>(null)
  // Locking hides the value at once.
  const shown = unlocked ? value : null
  const [busy, setBusy] = React.useState(false)
  const afterUnlock = React.useRef<(() => void) | null>(null)
  const timer = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  function withUnlock(run: () => void) {
    if (unlocked) run()
    else {
      afterUnlock.current = run
      setUnlockOpen(true)
    }
  }

  async function toggle() {
    if (shown !== null) {
      setValue(null)
      return
    }
    setBusy(true)
    try {
      const v = await revealSecret(item.id, item.accountId)
      setValue(v)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setValue(null), HIDE_MS)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't show that value.")
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await copySecretValue(revealSecret(item.id, item.accountId))
      toast.success(`${name} copied`, {
        description: `Cleared from the clipboard in ${CLEAR_MS / 1000} seconds.`,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't copy that value.")
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-1 text-xs">
        <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">
          In vault:{" "}
          <Link href={`/accounts/${item.accountId}`} className="underline-offset-4 hover:underline">
            {item.account}
          </Link>{" "}
          · {item.label}
        </span>
      </span>
      <span className="flex gap-1">
        <Button
          size="xs"
          variant="outline"
          disabled={busy}
          onClick={() => withUnlock(() => void toggle())}
          aria-label={shown !== null ? `Hide ${name} value` : `Show ${name} value`}
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : shown !== null ? (
            <EyeOff />
          ) : (
            <Eye />
          )}
          {shown !== null ? "Hide" : "Show"}
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => withUnlock(() => void copy())}
          aria-label={`Copy ${name} value`}
        >
          <Copy />
          Copy
        </Button>
      </span>
      {shown !== null ? (
        <code
          className="max-w-72 rounded bg-muted px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap"
          aria-label={`${name} value`}
        >
          {shown || "(empty)"}
        </code>
      ) : null}
      {unlockOpen ? (
        <UnlockVaultDialog
          open
          onOpenChange={setUnlockOpen}
          onUnlocked={() => {
            const run = afterUnlock.current
            afterUnlock.current = null
            run?.()
          }}
        />
      ) : null}
    </div>
  )
}
