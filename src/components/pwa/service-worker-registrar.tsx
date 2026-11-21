"use client"

import * as React from "react"

import { captureInstallPrompt } from "@/lib/pwa/install-prompt"

/**
 * Registers the service worker in production builds (Plan P9.2). The script URL carries the build
 * id, so every deploy installs a new worker with fresh caches; `updateViaCache: "none"` makes the
 * browser check the script on every visit. In development any earlier worker is removed, so it
 * can't serve stale build files to `pnpm dev`. Renders nothing.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    const releaseInstallPrompt = captureInstallPrompt()
    if (!("serviceWorker" in navigator)) return releaseInstallPrompt

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((all) => Promise.all(all.map((r) => r.unregister())))
        .catch(() => {})
      return releaseInstallPrompt
    }

    const version = encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? "dev")
    const register = () => {
      navigator.serviceWorker
        .register(`/sw.js?v=${version}`, { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Offline reading is an extra: the app works the same without a worker.
        })
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
    return () => {
      window.removeEventListener("load", register)
      releaseInstallPrompt()
    }
  }, [])
  return null
}
