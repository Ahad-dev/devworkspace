"use client"

import * as React from "react"

/**
 * Connection state for the UI (Plan P9.4). `navigator.onLine === false` is reliable; `true` only
 * means "a network exists", so writes also handle network failures (see guard.ts), and the
 * offline page checks the server is reachable before reloading.
 */

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

/** True on the server and during hydration, then the browser's view. */
export function useOnlineStatus() {
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}

/** Whether this app's server answers right now (a page request that skips every cache). */
export async function isServerReachable(path = "/login", timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    })
    // Any HTTP answer (even a redirect) means the server is there.
    return res.type === "opaqueredirect" || res.status > 0
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
