import { describe, expect, it } from "vitest"

import { handoffSchema, isEmptyHandoff, sessionDetailsSchema } from "@/features/sessions/schemas"
import {
  elapsedSeconds,
  formatClock,
  formatDuration,
  isStale,
  sessionErrorMessage,
} from "@/features/sessions/utils"

describe("elapsedSeconds", () => {
  const start = "2026-03-10T10:00:00.000Z"
  const at = (iso: string) => Date.parse(iso)

  it("adds the open segment to closed time", () => {
    expect(elapsedSeconds(120, start, at("2026-03-10T10:01:30.900Z"))).toBe(210)
  })
  it("is just closed time when paused", () => {
    expect(elapsedSeconds(3600, null, at("2026-03-11T00:00:00Z"))).toBe(3600)
  })
  it("never goes negative when the client clock is behind", () => {
    expect(elapsedSeconds(0, start, at("2026-03-10T09:59:00Z"))).toBe(0)
  })
})

describe("isStale", () => {
  const start = "2026-03-10T00:00:00Z"
  it("flags running segments older than 12 hours", () => {
    expect(isStale(start, Date.parse("2026-03-10T12:00:01Z"))).toBe(true)
    expect(isStale(start, Date.parse("2026-03-10T11:59:59Z"))).toBe(false)
    expect(isStale(null, Date.parse("2026-04-01T00:00:00Z"))).toBe(false)
  })
})

describe("formatting", () => {
  it.each([
    [0, "0:00"],
    [42, "0:42"],
    [725, "12:05"],
    [3729, "1:02:09"],
  ])("formatClock(%i) = %s", (s, out) => {
    expect(formatClock(s)).toBe(out)
  })
  it.each([
    [45, "45s"],
    [720, "12m"],
    [3900, "1h 05m"],
    [93600, "26h 00m"],
  ])("formatDuration(%i) = %s", (s, out) => {
    expect(formatDuration(s)).toBe(out)
  })
})

describe("sessionErrorMessage", () => {
  it("maps RPC hints and constraint codes", () => {
    expect(sessionErrorMessage({ code: "P0001", hint: "active_session_exists" })).toMatch(
      /Another work session/,
    )
    expect(sessionErrorMessage({ code: "23514" })).toMatch(/links/)
    expect(sessionErrorMessage(null)).toMatch(/Try again/)
  })
})

describe("handoffSchema", () => {
  const empty = {
    completed_summary: "",
    current_state: "",
    remaining_work: "",
    next_action: "",
    blockers: "",
    technical_notes: "",
    related_links: [],
  }

  it("treats an all-blank handoff as empty", () => {
    const parsed = handoffSchema.parse({ ...empty, next_action: "   " })
    expect(isEmptyHandoff(parsed)).toBe(true)
  })

  it("rejects secrets in notes and credential URLs in links", () => {
    expect(
      handoffSchema.safeParse({ ...empty, technical_notes: "key is sk_live_51HxYzAbCdEfGh" })
        .success,
    ).toBe(false)
    const r = handoffSchema.safeParse({
      ...empty,
      related_links: [{ label: "Logs", url: "https://admin:pw@logs.example.com" }],
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(["related_links", 0, "url"])
  })

  it("keeps valid links and trims text", () => {
    const parsed = handoffSchema.parse({
      ...empty,
      next_action: "  Run the migration  ",
      related_links: [{ label: "PR", url: "https://github.com/a/b/pull/1" }],
    })
    expect(parsed.next_action).toBe("Run the migration")
    expect(isEmptyHandoff(parsed)).toBe(false)
  })
})

describe("sessionDetailsSchema", () => {
  it("rejects branch names with spaces and maps empties to null", () => {
    expect(
      sessionDetailsSchema.safeParse({ branch_name: "my branch", notes: "", repository_id: "" })
        .success,
    ).toBe(false)
    expect(
      sessionDetailsSchema.parse({ branch_name: "", notes: "", repository_id: "none" }),
    ).toEqual({ branch_name: null, notes: null, repository_id: null })
  })
})
