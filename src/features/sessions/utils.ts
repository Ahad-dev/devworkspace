/** Pure session helpers shared by the header timer, task page, sessions page and tests. */

/** A running session whose current segment is older than this is "stale" (Plan P4.7). */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000

/** Seconds worked: closed segments plus the open one up to `now` (Spec: never a browser timer alone). */
export function elapsedSeconds(
  closedSeconds: number,
  openSegmentStartedAt: string | null,
  now: number = Date.now(),
) {
  const open = openSegmentStartedAt
    ? Math.max(0, Math.floor((now - Date.parse(openSegmentStartedAt)) / 1000))
    : 0
  return Math.max(0, closedSeconds) + open
}

export function isStale(openSegmentStartedAt: string | null, now: number = Date.now()) {
  return openSegmentStartedAt !== null && now - Date.parse(openSegmentStartedAt) > STALE_AFTER_MS
}

/** Timer display: "0:42", "12:05", "1:02:09". */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`
}

/** Summary display: "45s", "12m", "1h 05m", "26h 00m". */
export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`
}

/** Error hints raised by the session RPCs, mapped to what the user should read. */
export const SESSION_ERROR_MESSAGES: Record<string, string> = {
  active_session_exists: "Another work session is running. Pause or finish it first.",
  session_not_found: "That session no longer exists. Refresh and try again.",
  task_not_found: "That task no longer exists. Refresh and try again.",
  task_archived: "Restore the task before working on it.",
  session_not_active: "This session isn't running any more.",
  session_not_paused: "This session is already running.",
  session_completed: "This session is finished. Start a new one to keep working.",
  invalid_end_time: "The end time must be after the session's last start and not in the future.",
  invalid_link: "Each related link needs a label and an http(s) URL.",
  empty_handoff: "Write at least one field before saving.",
  task_required: "Choose a task to work on.",
}

export function sessionErrorMessage(error: { code?: string; hint?: string } | null) {
  if (error?.hint && SESSION_ERROR_MESSAGES[error.hint]) return SESSION_ERROR_MESSAGES[error.hint]!
  if (error?.code === "23514") {
    return "One of the values isn't allowed. Check links (http(s), no credentials) and lengths."
  }
  if (error?.code === "23503") return "The repository must belong to the task's project."
  return "Something went wrong. Try again."
}
