import { endOfDayInZone, toZonedDateInput } from "@/lib/timezones"

/** Pure dashboard helpers (Spec FR-02; Plan P7.1–P7.2), shared by queries, page and tests. */

/** "YYYY-MM-DD" plus n calendar days. */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** End of the 7th day after today, in the owner's timezone: the "upcoming" window. */
export function upcomingUntil(now: number, timeZone: string) {
  const today = toZonedDateInput(new Date(now).toISOString(), timeZone)
  return endOfDayInZone(addDays(today, 7), timeZone)
}

export function greeting(now: number, timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(
      new Date(now),
    ),
  )
  if (hour < 5) return "Working late"
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}
