"use client"

import * as React from "react"

/**
 * The unlocked vault key, in memory only (Plan P11.3; docs/SECURITY.md §8). Never in storage,
 * React props or the URL: components ask for it with `requireVaultKey()` at the moment they encrypt
 * or decrypt. It is a non-extractable CryptoKey, so page code can use it but not read it out.
 *
 * It locks after IDLE_MS without activity, when the page goes away (`pagehide`, which also covers
 * the back/forward cache), on sign-out and on the sign-in page, and in every tab when any tab locks.
 */

export const IDLE_MS = 15 * 60_000
const CHANNEL = "dw-vault"

type State = { key: CryptoKey | null; ownerId: string | null; lastActive: number }
let state: State = { key: null, ownerId: null, lastActive: 0 }
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function channel() {
  try {
    return new BroadcastChannel(CHANNEL)
  } catch {
    return null
  }
}

export function unlockVault(key: CryptoKey, ownerId: string) {
  state = { key, ownerId, lastActive: Date.now() }
  emit()
}

/** Forgets the key here and, unless this was a message from another tab, everywhere. */
export function lockVault({ broadcast = true }: { broadcast?: boolean } = {}) {
  const wasUnlocked = state.key !== null
  state = { key: null, ownerId: null, lastActive: 0 }
  if (wasUnlocked) emit()
  if (broadcast) {
    const c = channel()
    c?.postMessage("lock")
    c?.close()
  }
}

export function isVaultUnlocked() {
  if (state.key && Date.now() - state.lastActive > IDLE_MS) lockVault()
  return state.key !== null
}

/** The key for one operation; refreshes the idle timer. Throws when locked. */
export function requireVaultKey() {
  if (!isVaultUnlocked() || !state.key || !state.ownerId) throw new Error("The vault is locked.")
  state.lastActive = Date.now()
  return { key: state.key, ownerId: state.ownerId }
}

export function touchVault() {
  if (state.key) state.lastActive = Date.now()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** "locked" on the server and before hydration. */
export function useVaultUnlocked() {
  return React.useSyncExternalStore(subscribe, isVaultUnlocked, () => false)
}

/**
 * Runs the lock rules while the workspace is open. Mounted once, in the workspace layout.
 * Renders nothing.
 */
export function VaultLifecycle() {
  React.useEffect(() => {
    const onActivity = () => touchVault()
    const onPageHide = () => lockVault()
    const check = window.setInterval(() => isVaultUnlocked(), 30_000)
    const c = channel()
    if (c) c.onmessage = (e) => e.data === "lock" && lockVault({ broadcast: false })
    window.addEventListener("pointerdown", onActivity, { passive: true })
    window.addEventListener("keydown", onActivity)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.clearInterval(check)
      c?.close()
      window.removeEventListener("pointerdown", onActivity)
      window.removeEventListener("keydown", onActivity)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [])
  return null
}

/** Locks on mount: used on the sign-in page, where every way out of a session ends. */
export function LockVault() {
  React.useEffect(() => {
    lockVault()
  }, [])
  return null
}
