"use client"

import * as React from "react"
import { Download, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { isSnapshotUsable } from "@/features/offline/snapshot"
import { syncOfflineCopy } from "@/features/offline/sync"
import { formatDateTime } from "@/lib/format"
import {
  isKeepCopyEnabled,
  onOfflineChange,
  readStoredCopy,
  setKeepCopyEnabled,
  wipeOfflineData,
} from "@/lib/offline/store"
import { getInstallPrompt, promptInstall, subscribeInstallPrompt } from "@/lib/pwa/install-prompt"

type CopyInfo = { tasks: number; syncedAt: string; timeZone: string } | null

type DeviceState = {
  standalone: boolean
  ios: boolean
  worker: "ready" | "none" | "unsupported" | "development"
  keep: boolean
  copy: CopyInfo
}

const noSubscribe = () => () => {}

function readEnvironment() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  return { standalone, ios }
}

async function readCopy(): Promise<CopyInfo> {
  const value = await readStoredCopy()
  return isSnapshotUsable(value)
    ? { tasks: value.tasks.length, syncedAt: value.syncedAt, timeZone: value.timeZone }
    : null
}

/**
 * Settings → This device (Plan P9.5): install the app, and see or control the offline copy of
 * tasks kept in this browser. Everything here is about this browser only.
 */
export function DevicePanel() {
  const [state, setState] = React.useState<DeviceState | null>(null)
  const [busy, setBusy] = React.useState<"sync" | "delete" | "install" | null>(null)
  const installable = React.useSyncExternalStore(
    subscribeInstallPrompt,
    () => getInstallPrompt() !== null,
    () => false,
  )
  const hydrated = React.useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )

  // Bumped to re-read this browser's state after an action that may not announce a change.
  const [reads, setReads] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      let worker: DeviceState["worker"] = "unsupported"
      if (process.env.NODE_ENV !== "production") worker = "development"
      else if ("serviceWorker" in navigator) {
        worker = (await navigator.serviceWorker.getRegistration("/"))?.active ? "ready" : "none"
      }
      const copy = await readCopy()
      if (!cancelled) setState({ ...readEnvironment(), worker, keep: isKeepCopyEnabled(), copy })
    }
    void load()
    const unsubscribe = onOfflineChange(() => void load())
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [reads])

  async function syncNow() {
    setBusy("sync")
    const outcome = await syncOfflineCopy({ force: true })
    setBusy(null)
    if (outcome === "synced") toast.success("Offline copy updated")
    else if (outcome === "offline") toast.error("You're offline. Reconnect to update the copy.")
    else if (outcome === "skipped") toast.message("Another tab is updating the copy")
    else toast.error("Couldn't update the offline copy. Try again.")
    setReads((n) => n + 1)
  }

  async function deleteCopy() {
    setBusy("delete")
    await wipeOfflineData()
    setBusy(null)
    toast.success(
      state?.keep
        ? "Offline copy deleted. It's saved again on your next visit unless you turn it off below."
        : "Offline copy deleted",
    )
  }

  function changeKeep(keep: boolean) {
    setKeepCopyEnabled(keep)
    if (keep) void syncOfflineCopy({ force: true })
    else void wipeOfflineData()
    setState((s) => (s ? { ...s, keep } : s))
  }

  async function install() {
    setBusy("install")
    const accepted = await promptInstall()
    setBusy(null)
    if (accepted) toast.success("DevWorkspace installed")
  }

  if (!hydrated || !state) {
    return <p className="text-sm text-muted-foreground">Checking this browser…</p>
  }

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="flex flex-col gap-2">
        <h3 className="font-medium">App</h3>
        {state.standalone ? (
          <p>You&apos;re using the installed app.</p>
        ) : installable ? (
          <div>
            <Button size="sm" variant="outline" onClick={install} disabled={busy === "install"}>
              {busy === "install" ? <Loader2 className="animate-spin" aria-hidden /> : <Download />}
              Install DevWorkspace
            </Button>
          </div>
        ) : state.ios ? (
          <p>
            To install on iPhone or iPad, open this site in Safari, tap Share, then{" "}
            <span className="font-medium">Add to Home Screen</span>. Sign in again inside the app:
            it keeps its own sign-in and offline copy.
          </p>
        ) : (
          <p className="text-muted-foreground">
            To install, use your browser&apos;s Install option in the address bar or menu.
          </p>
        )}
        <p className="text-muted-foreground">
          Offline page:{" "}
          {state.worker === "ready"
            ? "ready"
            : state.worker === "development"
              ? "off in development builds"
              : state.worker === "none"
                ? "not ready yet (reload once)"
                : "not supported in this browser"}
          {" · "}Version {process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Offline copy of tasks</h3>
        <div className="flex items-start gap-2">
          <Checkbox
            id="keep-offline-copy"
            checked={state.keep}
            onCheckedChange={(v) => changeKeep(v === true)}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="keep-offline-copy">Keep a copy of my tasks on this device</Label>
            <p className="text-muted-foreground">
              Open tasks and those completed in the last two weeks, readable without a connection.
              Deleted when you sign out, and after 30 days without an update. Turn it off on a
              shared computer.
            </p>
          </div>
        </div>
        <p role="status">
          {!state.keep
            ? "No copy is kept on this device."
            : state.copy
              ? `${state.copy.tasks} tasks saved ${formatDateTime(state.copy.syncedAt, state.copy.timeZone)}.`
              : "No copy saved yet."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={syncNow}
            disabled={!state.keep || busy !== null}
          >
            {busy === "sync" ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw />}
            Update now
          </Button>
          <Button size="sm" variant="outline" onClick={deleteCopy} disabled={busy !== null}>
            {busy === "delete" ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 />}
            Delete offline copy
          </Button>
        </div>
      </div>
    </div>
  )
}
