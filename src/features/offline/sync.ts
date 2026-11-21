import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"
import {
  getWipeEpoch,
  isKeepCopyEnabled,
  readStoredCopy,
  wipeOfflineData,
  writeStoredCopy,
} from "@/lib/offline/store"
import { fetchOfflineData } from "./fetch-snapshot"
import { belongsTo, buildSnapshot } from "./snapshot"

/**
 * Refreshes the offline copy (Plan P9.3). Browser-only. Rules:
 * - only when online, signed in and "Keep a copy on this device" is on (otherwise it wipes);
 * - a copy that belongs to another user is wiped before anything is written;
 * - one sync at a time across tabs (Web Locks), and none more often than MIN_INTERVAL_MS unless
 *   forced (Refresh now, or a change the user just saved);
 * - nothing is written if a wipe or a sign-out happened while it was reading.
 */

export type SyncOutcome = "synced" | "skipped" | "offline" | "wiped" | "failed"

const MIN_INTERVAL_MS = 60_000
const LOCK = "dw-offline-sync"

let lastSynced = 0
let running: Promise<SyncOutcome> | null = null
let persistAsked = false

export function syncOfflineCopy({ force = false }: { force?: boolean } = {}): Promise<SyncOutcome> {
  if (typeof window === "undefined") return Promise.resolve("skipped")
  if (!navigator.onLine) return Promise.resolve("offline")
  if (!force && Date.now() - lastSynced < MIN_INTERVAL_MS) return Promise.resolve("skipped")
  if (running) return running

  const locks = (navigator as Navigator & { locks?: LockManager }).locks
  const attempt = locks
    ? new Promise<SyncOutcome>((resolve, reject) => {
        // ifAvailable: another tab is already syncing, so this one has nothing to do.
        locks
          .request(LOCK, { ifAvailable: true }, async (lock) => {
            resolve(lock ? await run() : "skipped")
          })
          .catch(reject)
      })
    : run()
  const current = attempt
    .catch((): SyncOutcome => "failed")
    .finally(() => {
      running = null
    })
  running = current
  return current
}

async function run(): Promise<SyncOutcome> {
  if (!isKeepCopyEnabled()) {
    if (await readStoredCopy()) await wipeOfflineData()
    return "wiped"
  }

  const db = createClient()
  const { data, error } = await db.auth.getUser()
  if (error && !isAuthSessionMissingError(error) && !isSignedOutError(error)) return "failed"
  const user = error ? null : data.user
  if (!user) {
    await wipeOfflineData()
    return "wiped"
  }

  const stored = await readStoredCopy()
  if (stored && !belongsTo(stored, user.id)) await wipeOfflineData()
  const epoch = getWipeEpoch()

  const now = new Date()
  const raw = await fetchOfflineData(db, user.id, now)
  const snapshot = buildSnapshot(raw, { userId: user.id, now })

  // Signed out, wiped or switched off while reading: write nothing.
  const { data: session } = await db.auth.getSession()
  if (getWipeEpoch() !== epoch || !isKeepCopyEnabled() || session.session?.user.id !== user.id) {
    return "skipped"
  }
  await writeStoredCopy(snapshot)
  lastSynced = Date.now()

  if (!persistAsked) {
    persistAsked = true
    // Best effort: asks the browser not to evict the copy under storage pressure.
    void navigator.storage?.persist?.().catch(() => false)
  }
  return "synced"
}

/** The token was rejected (user deleted, session revoked): treat as signed out. */
function isSignedOutError(error: unknown) {
  return isAuthApiError(error) && (error.status === 401 || error.status === 403)
}
