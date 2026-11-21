import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isNetworkError,
  OFFLINE_WRITE_MESSAGE,
  offlineFormState,
  offlineResult,
  whenOnline,
} from "@/lib/offline/guard"

type Result = { ok: true } | { ok: false; error: string }

/** Edits need a connection (Plan P9.5): offline becomes the action's own error result. */
function setOnline(value: boolean) {
  vi.stubGlobal("navigator", { onLine: value })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("whenOnline", () => {
  it("doesn't call the action while offline", async () => {
    setOnline(false)
    const run = vi.fn(async (): Promise<Result> => ({ ok: true }))
    await expect(whenOnline(run, offlineResult)).resolves.toEqual({
      ok: false,
      error: OFFLINE_WRITE_MESSAGE,
    })
    expect(run).not.toHaveBeenCalled()
  })

  it("returns the action's result when online", async () => {
    setOnline(true)
    await expect(
      whenOnline(async (): Promise<Result> => ({ ok: true }), offlineResult),
    ).resolves.toEqual({
      ok: true,
    })
  })

  it("turns a failed request into the offline result", async () => {
    setOnline(true)
    const run = async () => {
      throw new TypeError("Failed to fetch")
    }
    await expect(whenOnline(run, offlineFormState)).resolves.toEqual({
      status: "error",
      message: OFFLINE_WRITE_MESSAGE,
    })
  })

  it("rethrows anything else", async () => {
    setOnline(true)
    const boom = new Error("NEXT_REDIRECT")
    await expect(
      whenOnline(async () => {
        throw boom
      }, offlineResult),
    ).rejects.toBe(boom)
  })
})

describe("isNetworkError", () => {
  it.each([
    "Failed to fetch",
    "NetworkError when attempting to fetch resource.",
    "Load failed",
    "fetch failed",
  ])("%s", (message) => {
    expect(isNetworkError(new TypeError(message))).toBe(true)
  })

  it("ignores other errors", () => {
    expect(isNetworkError(new TypeError("x is not a function"))).toBe(false)
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(false)
  })
})
