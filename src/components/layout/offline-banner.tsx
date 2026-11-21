"use client"

import { WifiOff } from "lucide-react"

import { useOnlineStatus } from "@/lib/offline/connectivity"

/**
 * Shown above the page while the browser reports no connection (Plan P9.4). Pages that need the
 * server won't load, but the saved copy of tasks will.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  return (
    <div role="status" aria-live="polite">
      {online ? null : (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-muted px-4 py-2 text-sm">
          <WifiOff className="size-4 shrink-0" aria-hidden />
          <span>You&apos;re offline. Changes can&apos;t be saved until you reconnect.</span>
          <a href="/my-work" className="font-medium underline underline-offset-4">
            Open your saved tasks
          </a>
        </p>
      )}
    </div>
  )
}
