import { describe, expect, it } from "vitest"

import { isKnownTimezone, listTimezones, utcOffsetLabel } from "@/lib/timezones"

describe("timezones", () => {
  it("always offers UTC", () => {
    expect(listTimezones()).toContain("UTC")
    expect(isKnownTimezone("UTC")).toBe(true)
  })

  it("recognizes IANA names and rejects unknown ones", () => {
    expect(isKnownTimezone("Asia/Karachi")).toBe(true)
    expect(isKnownTimezone("Europe/London")).toBe(true)
    expect(isKnownTimezone("Mars/Olympus_Mons")).toBe(false)
  })

  it("formats UTC offsets", () => {
    const winter = new Date("2026-01-15T12:00:00Z")
    expect(utcOffsetLabel("UTC", winter)).toBe("UTC+00:00")
    expect(utcOffsetLabel("Asia/Karachi", winter)).toBe("UTC+05:00")
    expect(utcOffsetLabel("America/New_York", winter)).toBe("UTC-05:00")
  })

  it("returns an empty label instead of throwing for bad input", () => {
    expect(utcOffsetLabel("Mars/Olympus_Mons")).toBe("")
  })
})
