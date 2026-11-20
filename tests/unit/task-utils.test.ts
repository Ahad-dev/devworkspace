import { describe, expect, it } from "vitest"

import {
  compareTasks,
  isOverdue,
  missingNextAction,
  parseTaskFilters,
} from "@/features/tasks/utils"
import { endOfDayInZone, toZonedDateInput } from "@/lib/timezones"

const base = {
  status: "ready" as const,
  due_at: null,
  next_action: null,
  priority: "medium" as const,
}

describe("isOverdue", () => {
  const now = new Date("2026-03-10T12:00:00Z")
  it("is overdue only when the due date has passed and the task isn't done", () => {
    expect(isOverdue({ ...base, due_at: "2026-03-09T23:59:59Z" }, now)).toBe(true)
    expect(isOverdue({ ...base, due_at: "2026-03-11T00:00:00Z" }, now)).toBe(false)
    expect(isOverdue({ ...base, status: "done", due_at: "2026-01-01T00:00:00Z" }, now)).toBe(false)
    expect(isOverdue({ ...base, due_at: null }, now)).toBe(false)
  })

  it("respects the user's timezone through end-of-day due dates", () => {
    // Due "2026-03-10" in Karachi (UTC+5) ends at 18:59:59Z; in LA (UTC-7 in March) at 06:59:59Z next day.
    const karachi = endOfDayInZone("2026-03-10", "Asia/Karachi")
    const la = endOfDayInZone("2026-03-10", "America/Los_Angeles")
    expect(karachi).toBe("2026-03-10T18:59:59.000Z")
    expect(la).toBe("2026-03-11T06:59:59.000Z")
    const at = new Date("2026-03-10T20:00:00Z")
    expect(isOverdue({ ...base, due_at: karachi }, at)).toBe(true)
    expect(isOverdue({ ...base, due_at: la }, at)).toBe(false)
  })
})

describe("timezone date round trip", () => {
  it.each(["UTC", "Asia/Karachi", "America/Los_Angeles", "Pacific/Auckland"])(
    "keeps the calendar date in %s",
    (tz) => {
      expect(toZonedDateInput(endOfDayInZone("2026-07-04", tz), tz)).toBe("2026-07-04")
      // Across a DST change (US: 8 Mar 2026; NZ: 5 Apr 2026).
      expect(toZonedDateInput(endOfDayInZone("2026-03-08", tz), tz)).toBe("2026-03-08")
      expect(toZonedDateInput(endOfDayInZone("2026-04-05", tz), tz)).toBe("2026-04-05")
    },
  )
  it("returns an empty string for no date", () => {
    expect(toZonedDateInput(null, "UTC")).toBe("")
  })
})

describe("missingNextAction", () => {
  it("flags only in-progress tasks without a next action", () => {
    expect(missingNextAction({ status: "in_progress", next_action: null })).toBe(true)
    expect(missingNextAction({ status: "in_progress", next_action: "   " })).toBe(true)
    expect(missingNextAction({ status: "in_progress", next_action: "Fix the FK" })).toBe(false)
    expect(missingNextAction({ status: "ready", next_action: null })).toBe(false)
  })
})

describe("compareTasks", () => {
  it("orders by priority, then due date (undated last), then recency", () => {
    const tasks = [
      { ...base, title: "low", priority: "low" as const },
      { ...base, title: "urgent-undated", priority: "urgent" as const },
      {
        ...base,
        title: "urgent-soon",
        priority: "urgent" as const,
        due_at: "2026-01-01T00:00:00Z",
      },
      { ...base, title: "high-old", priority: "high" as const, updated_at: "2026-01-01" },
      { ...base, title: "high-new", priority: "high" as const, updated_at: "2026-02-01" },
    ]
    expect([...tasks].sort(compareTasks).map((t) => t.title)).toEqual([
      "urgent-soon",
      "urgent-undated",
      "high-new",
      "high-old",
      "low",
    ])
  })
})

describe("parseTaskFilters", () => {
  it("defaults sensibly", () => {
    expect(parseTaskFilters({})).toMatchObject({
      view: "all",
      layout: "list",
      statuses: [],
      priorities: [],
      flags: [],
      sort: "priority",
      page: 1,
      projectId: null,
    })
  })

  it("keeps valid values and drops the rest", () => {
    const f = parseTaskFilters({
      view: "blocked",
      layout: "board",
      status: "ready,bogus,in_progress",
      priority: "urgent,extreme",
      flags: "overdue,nope",
      project: "not-a-uuid",
      label: "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
      sort: "due",
      page: "3",
      q: "  migrate  ",
    })
    expect(f).toMatchObject({
      view: "blocked",
      layout: "board",
      statuses: ["ready", "in_progress"],
      priorities: ["urgent"],
      flags: ["overdue"],
      projectId: null,
      labelId: "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
      sort: "due",
      page: 3,
      q: "migrate",
    })
  })

  it("rejects nonsense pages and views", () => {
    expect(parseTaskFilters({ view: "secret", page: "-2" })).toMatchObject({ view: "all", page: 1 })
  })
})
