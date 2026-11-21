/**
 * Asks the workspace's offline sync to refresh the copy soon (Plan P9.3), e.g. after the user
 * saved a change. Debounced, so a burst of edits causes one sync. A no-op on the server.
 */

const EVENT = "dw-offline-sync-request"
const DEBOUNCE_MS = 3000

let timer: ReturnType<typeof setTimeout> | undefined

export function requestOfflineSync({ immediate = false }: { immediate?: boolean } = {}) {
  if (typeof window === "undefined") return
  clearTimeout(timer)
  timer = setTimeout(() => window.dispatchEvent(new Event(EVENT)), immediate ? 0 : DEBOUNCE_MS)
}

export function onOfflineSyncRequest(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
