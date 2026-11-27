import { afterEach, describe, expect, it, vi } from "vitest"

import {
  IDLE_MS,
  isVaultUnlocked,
  lockVault,
  requireVaultKey,
  touchVault,
  unlockVault,
} from "@/features/vault/store"

/** The in-memory unlock state (Plan P11.3): idle lock and explicit lock. */
const fakeKey = {} as CryptoKey

afterEach(() => {
  lockVault({ broadcast: false })
  vi.useRealTimers()
})

describe("vault store", () => {
  it("locks after the idle time, and activity keeps it open", () => {
    vi.useFakeTimers()
    unlockVault(fakeKey, "owner")
    expect(isVaultUnlocked()).toBe(true)

    vi.advanceTimersByTime(IDLE_MS - 1000)
    touchVault()
    vi.advanceTimersByTime(IDLE_MS - 1000)
    expect(isVaultUnlocked()).toBe(true)

    vi.advanceTimersByTime(2000)
    expect(isVaultUnlocked()).toBe(false)
    expect(() => requireVaultKey()).toThrow("locked")
  })

  it("hands out the key while unlocked, and nothing once locked", () => {
    unlockVault(fakeKey, "owner")
    expect(requireVaultKey()).toEqual({ key: fakeKey, ownerId: "owner" })
    lockVault({ broadcast: false })
    expect(isVaultUnlocked()).toBe(false)
    expect(() => requireVaultKey()).toThrow("locked")
  })
})
