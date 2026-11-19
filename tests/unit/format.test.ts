import { describe, expect, it } from "vitest"

import { formatDate, formatDateTime, formatRelative } from "@/lib/format"

describe("format", () => {
  it("shows date-only values as calendar dates, unaffected by timezone", () => {
    // A date column must not shift to the previous day in negative-offset zones.
    expect(formatDate("2026-03-01", "America/Los_Angeles")).toBe("1 Mar 2026")
    expect(formatDate("2026-03-01", "Asia/Karachi")).toBe("1 Mar 2026")
  })

  it("shows timestamps in the user's timezone", () => {
    expect(formatDateTime("2026-01-15T22:30:00Z", "UTC")).toBe("15 Jan 2026, 22:30")
    expect(formatDateTime("2026-01-15T22:30:00Z", "Asia/Karachi")).toBe("16 Jan 2026, 03:30")
  })

  it("returns null for missing values", () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDateTime(undefined)).toBeNull()
  })

  it("formats relative times", () => {
    const now = new Date("2026-01-15T12:00:00Z")
    expect(formatRelative("2026-01-15T11:59:30Z", now)).toBe("just now")
    expect(formatRelative("2026-01-15T09:00:00Z", now)).toBe("3 hours ago")
    expect(formatRelative("2026-01-14T12:00:00Z", now)).toBe("yesterday")
    expect(formatRelative("2026-01-01T12:00:00Z", now)).toBe("2 weeks ago")
  })
})
