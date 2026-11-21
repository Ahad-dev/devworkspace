/**
 * Device storage for the offline copy (Plan P9.3): one IndexedDB record, plus two small
 * localStorage values. Browser-only; every function is safe to call where storage is missing or
 * blocked (it then does nothing or returns null).
 *
 * - A connection is opened per operation and closed right after, and closes itself on
 *   `versionchange`, so deleting the database is never blocked by another tab for long.
 * - Wiping bumps an epoch in localStorage: a sync that started before a wipe checks it and
 *   doesn't write afterwards. Other tabs hear about wipes and updates on a BroadcastChannel.
 */

const DB_NAME = "devworkspace-offline"
const STORE = "snapshot"
const KEY = "current"
const EPOCH_KEY = "dw-offline-epoch"
const KEEP_KEY = "dw-offline-keep"
const CHANNEL = "dw-offline"
const UPDATE_EVENT = "dw-offline-change"

export type OfflineChange = "updated" | "wiped"

function hasIndexedDb() {
  return typeof indexedDB !== "undefined"
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error("Offline storage is busy"))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** The stored copy as saved (validate it before use), or null. */
export async function readStoredCopy(): Promise<unknown> {
  if (!hasIndexedDb()) return null
  try {
    return (await withStore("readonly", (s) => s.get(KEY))) ?? null
  } catch {
    return null
  }
}

export async function writeStoredCopy(value: unknown): Promise<void> {
  if (!hasIndexedDb()) return
  await withStore("readwrite", (s) => s.put(value, KEY))
  announce("updated")
}

/** Deletes the offline copy from this browser and tells other tabs. */
export async function wipeOfflineData(): Promise<void> {
  bumpEpoch()
  if (hasIndexedDb()) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      // Another tab's connection closes on versionchange; don't wait forever if one doesn't.
      const timer = setTimeout(resolve, 3000)
      req.onsuccess = req.onerror = () => {
        clearTimeout(timer)
        resolve()
      }
    })
  }
  announce("wiped")
}

/* Wipe epoch ------------------------------------------------------------------ */

export function getWipeEpoch(): string {
  try {
    return localStorage.getItem(EPOCH_KEY) ?? "0"
  } catch {
    return "0"
  }
}

function bumpEpoch() {
  try {
    localStorage.setItem(EPOCH_KEY, String(Number(getWipeEpoch()) + 1))
  } catch {
    // Storage blocked: nothing to protect either.
  }
}

/* "Keep a copy on this device" (default on) ----------------------------------- */

export function isKeepCopyEnabled(): boolean {
  try {
    return localStorage.getItem(KEEP_KEY) !== "0"
  } catch {
    return false
  }
}

export function setKeepCopyEnabled(keep: boolean) {
  try {
    if (keep) localStorage.removeItem(KEEP_KEY)
    else localStorage.setItem(KEEP_KEY, "0")
  } catch {
    // Storage blocked: there is no copy to keep anyway.
  }
}

/* Change notifications ---------------------------------------------------------- */

function announce(change: OfflineChange) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<OfflineChange>(UPDATE_EVENT, { detail: change }))
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage(change)
    channel.close()
  } catch {
    // No BroadcastChannel: other tabs pick the change up on their next read.
  }
}

/** Calls `listener` when the copy changes in this tab or another one. Returns an unsubscribe. */
export function onOfflineChange(listener: (change: OfflineChange) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const local = (e: Event) => listener((e as CustomEvent<OfflineChange>).detail)
  window.addEventListener(UPDATE_EVENT, local)
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e: MessageEvent<OfflineChange>) => listener(e.data)
  } catch {
    channel = null
  }
  return () => {
    window.removeEventListener(UPDATE_EVENT, local)
    channel?.close()
  }
}
