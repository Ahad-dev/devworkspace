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
