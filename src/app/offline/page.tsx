import type { Metadata } from "next"

import { OfflineApp } from "@/features/offline/components/offline-app"

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
}

/**
 * The offline shell (Plan P9.2, P9.4). Static and public: its HTML holds no user data, so the
 * service worker can keep it and serve it in place of any page that can't load. Everything shown
 * comes from this device's saved copy, read in the browser. Lives outside (workspace), whose header
 * renders per-request session data.
 */
export default function OfflinePage() {
  return <OfflineApp />
}
