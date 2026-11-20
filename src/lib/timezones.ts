/**
 * IANA timezone names known to this runtime. Postgres (pg_timezone_names) is the final
 * authority: the profiles trigger rejects anything it doesn't know.
 */
export function listTimezones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone")
  return zones.includes("UTC") ? zones : ["UTC", ...zones]
}

export function isKnownTimezone(tz: string) {
  return tz === "UTC" || Intl.supportedValuesOf("timeZone").includes(tz)
}

/** e.g. "UTC+05:00" for display next to the zone name. */
export function utcOffsetLabel(tz: string, at: Date = new Date()) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value
    return part === "GMT" ? "UTC+00:00" : (part?.replace("GMT", "UTC") ?? "")
  } catch {
    return ""
  }
}

/** Offset (ms) of `tz` from UTC at instant `at`: positive east of UTC. */
function zoneOffsetMs(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  )
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/**
 * "2026-12-01" in `tz` → ISO instant for 23:59:59 that day in `tz`. Due dates are calendar days
 * in the user's timezone, so a task due "today" isn't overdue until the day actually ends there.
 */
export function endOfDayInZone(date: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  const wall = Date.UTC(y, m - 1, d, 23, 59, 59)
  // Two passes settle DST transitions.
  let utc = wall - zoneOffsetMs(tz, new Date(wall))
  utc = wall - zoneOffsetMs(tz, new Date(utc))
  return new Date(utc).toISOString()
}

/** ISO instant → "YYYY-MM-DD" calendar date in `tz` (for date inputs). */
export function toZonedDateInput(iso: string | null | undefined, tz: string): string {
  if (!iso) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}
