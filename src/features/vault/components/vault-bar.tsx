"use client"

import * as React from "react"
import { Lock, LockKeyhole, LockKeyholeOpen, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { lockVault, useVaultUnlocked } from "../store"
import { SetupVaultDialog } from "./setup-vault-dialog"
import { UnlockVaultDialog } from "./unlock-dialog"

/** The vault's state and its one next step: set up, unlock or lock (Plan P11.4). */
export function VaultBar({ hasVault }: { hasVault: boolean }) {
  const unlocked = useVaultUnlocked()
  const [dialog, setDialog] = React.useState<"setup" | "unlock" | null>(null)

  if (!hasVault) {
    return (
      <section
        aria-labelledby="vault-setup-heading"
        className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            <h2 id="vault-setup-heading" className="text-sm font-semibold">
              Keep passwords and API keys here, encrypted
            </h2>
            <p className="text-sm text-muted-foreground">
              Set up a vault with a master password. Values are encrypted on your device before they
              are saved; DevWorkspace never sees them.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialog("setup")}>
          Set up vault
        </Button>
        <SetupVaultDialog
          open={dialog === "setup"}
          onOpenChange={(o) => setDialog(o ? "setup" : null)}
        />
      </section>
    )
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
    >
      <span className="flex items-center gap-2">
        {unlocked ? (
          <LockKeyholeOpen className="size-4 text-status-done" aria-hidden />
        ) : (
          <LockKeyhole className="size-4 text-muted-foreground" aria-hidden />
        )}
        {unlocked
          ? "Vault unlocked on this device. It locks after 15 minutes without use."
          : "Vault locked. Unlock it to see or copy stored values."}
      </span>
      {unlocked ? (
        <Button size="sm" variant="outline" onClick={() => lockVault()}>
          <Lock />
          Lock now
        </Button>
      ) : (
        <Button size="sm" onClick={() => setDialog("unlock")}>
          <LockKeyholeOpen />
          Unlock
        </Button>
      )}
      <UnlockVaultDialog
        open={dialog === "unlock"}
        onOpenChange={(o) => setDialog(o ? "unlock" : null)}
      />
    </div>
  )
}
