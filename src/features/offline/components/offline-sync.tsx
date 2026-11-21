"use client"

import * as React from "react"

import { onOfflineSyncRequest } from "@/lib/offline/sync-request"
import { syncOfflineCopy } from "../sync"

const INTERVAL_MS = 5 * 60_000

/**
 * Keeps this device's offline copy of tasks fresh while the workspace is open (Plan P9.3): on load,
 * when the tab becomes visible, when the connection returns, every five minutes, and when a saved
 * change asks for it. Renders nothing.
 */
export function OfflineSync() {
  React.useEffect(() => {
    const sync = () => void syncOfflineCopy()
    const forced = () => void syncOfflineCopy({ force: true })
    const onVisible = () => {
      if (document.visibilityState === "visible") sync()
    }

    sync()
    const interval = window.setInterval(sync, INTERVAL_MS)
    window.addEventListener("online", sync)
    document.addEventListener("visibilitychange", onVisible)
    const unsubscribe = onOfflineSyncRequest(forced)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("online", sync)
      document.removeEventListener("visibilitychange", onVisible)
      unsubscribe()
    }
  }, [])

  return null
}
