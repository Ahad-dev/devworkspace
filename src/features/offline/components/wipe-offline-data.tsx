"use client"

import * as React from "react"

import { wipeOfflineData } from "@/lib/offline/store"

/**
 * Deletes this device's offline copy (Plan P9.3). Mounted on the sign-in page, which every way out
 * of a session ends on: signing out, deleting the account, and an expired or revoked session.
 */
export function WipeOfflineData() {
  React.useEffect(() => {
    void wipeOfflineData()
  }, [])
  return null
}
