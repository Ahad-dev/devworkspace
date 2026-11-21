import { requestOfflineSync } from "./sync-request"

/**
 * Edits need a connection (Spec §2.2; Plan P9.5). Wrapping a server-action call in `whenOnline`
 * turns "no network" into the action's own error result, so the existing toast or inline message
 * says so and optimistic UI rolls back, instead of the page failing. Any other error is rethrown
 * unchanged. A change that reached the server refreshes the device's offline copy soon after.
 */

export const OFFLINE_WRITE_MESSAGE = "You're offline. Reconnect to save this change."

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

/** A request that never reached the server (Chrome, Firefox, Safari and Node wordings). */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(
      error.message,
    )
  )
}

export async function whenOnline<T>(run: () => Promise<T>, offline: () => T): Promise<T> {
  if (isOffline()) return offline()
  try {
    const result = await run()
    requestOfflineSync()
    return result
  } catch (error) {
    if (isNetworkError(error) || isOffline()) return offline()
    throw error
  }
}

/** The offline result for actions returning `{ ok, error }`. */
export const offlineResult = () => ({ ok: false as const, error: OFFLINE_WRITE_MESSAGE })

/** The offline result for form actions returning a FormState. */
export const offlineFormState = () => ({ status: "error" as const, message: OFFLINE_WRITE_MESSAGE })
