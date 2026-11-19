/** Date display in the user's profile timezone (Spec §8.1: store UTC, display in profile tz). */

export function formatDate(value: string | null | undefined, timeZone = "UTC") {
  if (!value) return null
  // Date-only columns (YYYY-MM-DD) are calendar dates: format them without shifting timezones.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(isDateOnly ? `${value}T00:00:00Z` : value)
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: isDateOnly ? "UTC" : timeZone,
  }).format(date)
}

export function formatDateTime(value: string | null | undefined, timeZone = "UTC") {
  if (!value) return null
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value))
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
]

/** "3 hours ago", "yesterday". `now` is injectable for tests. */
export function formatRelative(value: string, now: Date = new Date()) {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return "just now"
}
