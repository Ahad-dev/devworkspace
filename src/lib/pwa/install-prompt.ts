/**
 * The browser's install prompt (Plan P9.5), kept so Settings → This device can offer an Install
 * button. Chromium only; iOS Safari has no prompt (Share → Add to Home Screen instead).
 */

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Called once at startup by the service-worker registrar. */
export function captureInstallPrompt(): () => void {
  const onPrompt = (e: Event) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    emit()
  }
  const onInstalled = () => {
    deferred = null
    emit()
  }
  window.addEventListener("beforeinstallprompt", onPrompt)
  window.addEventListener("appinstalled", onInstalled)
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt)
    window.removeEventListener("appinstalled", onInstalled)
  }
}

export function getInstallPrompt() {
  return deferred
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Shows the prompt; true when the user accepted. The prompt can be used only once. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  deferred = null
  emit()
  await event.prompt()
  return (await event.userChoice).outcome === "accepted"
}
