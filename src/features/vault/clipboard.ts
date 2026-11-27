"use client"

/**
 * Copies a vault value and clears it from the clipboard after CLEAR_MS (Plan P11.5). Clearing is
 * best effort: browsers only allow it while the page has focus, and Windows clipboard history or a
 * cloud clipboard may keep a copy (docs/SECURITY.md §8). A later copy cancels the pending clear.
 */

export const CLEAR_MS = 30_000
let generation = 0

export async function copySecretValue(value: Promise<string>) {
  const mine = ++generation
  try {
    // Safari loses the click's permission while the value decrypts; a promised item keeps it.
    await navigator.clipboard.write([
      new ClipboardItem({ "text/plain": value.then((v) => new Blob([v], { type: "text/plain" })) }),
    ])
  } catch {
    await navigator.clipboard.writeText(await value)
  }
  window.setTimeout(() => {
    if (mine !== generation || !document.hasFocus()) return
    void navigator.clipboard.writeText("").catch(() => {})
  }, CLEAR_MS)
}
