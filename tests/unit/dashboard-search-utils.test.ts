import { describe, expect, it } from "vitest"

import { addDays, greeting, upcomingUntil } from "@/features/dashboard/utils"
import {
  groupResults,
  metaLabel,
  resultHref,
  splitHighlights,
  toResults,
  type SearchRow,
} from "@/features/search/utils"

/** Phase 7 (Spec FR-02, FR-12; Plan P7.1, P7.4–P7.5): dashboard dates and search presentation. */

describe("dashboard dates", () => {
  it("adds calendar days across months and years", () => {
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05")
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02")
    expect(addDays("2028-02-27", 2)).toBe("2028-02-29")
  })

  it("ends the upcoming window at the end of the 7th day in the owner's timezone", () => {
    // 2026-11-20 20:00 UTC is already 2026-11-21 01:00 in Karachi (UTC+5).
    const now = Date.parse("2026-11-20T20:00:00Z")
    expect(upcomingUntil(now, "Asia/Karachi")).toBe("2026-11-28T18:59:59.000Z")
    expect(upcomingUntil(now, "UTC")).toBe("2026-11-27T23:59:59.000Z")
  })

  it("greets by the owner's local hour", () => {
    const at = Date.parse("2026-11-20T04:00:00Z")
    expect(greeting(at, "UTC")).toBe("Working late")
    expect(greeting(at, "Asia/Karachi")).toBe("Good morning")
    // 23:00 the evening before in New York (UTC-5).
    expect(greeting(at, "America/New_York")).toBe("Good evening")
    expect(greeting(Date.parse("2026-11-20T14:00:00Z"), "UTC")).toBe("Good afternoon")
    expect(greeting(Date.parse("2026-11-20T19:00:00Z"), "UTC")).toBe("Good evening")
  })
})

const row = (over: Partial<SearchRow> & Pick<SearchRow, "kind">): SearchRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  title: "Title",
  excerpt: null,
  meta: null,
  project_id: "22222222-2222-4222-8222-222222222222",
  project_name: "Portal",
  parent_id: null,
  ...over,
})

describe("search results", () => {
  it("links each kind to its page or project tab", () => {
    const p = "22222222-2222-4222-8222-222222222222"
    const id = "11111111-1111-4111-8111-111111111111"
    expect(resultHref({ ...row({ kind: "project" }), kind: "project" })).toBe(`/projects/${id}`)
    expect(resultHref({ ...row({ kind: "task" }), kind: "task" })).toBe(`/tasks/${id}`)
    expect(resultHref({ ...row({ kind: "document" }), kind: "document" })).toBe(
      `/knowledge/documents/${id}`,
    )
    expect(resultHref({ ...row({ kind: "environment" }), kind: "environment" })).toBe(
      `/environments/${id}`,
    )
    expect(resultHref({ ...row({ kind: "variable", parent_id: "e" }), kind: "variable" })).toBe(
      `/environments/e`,
    )
    expect(resultHref({ ...row({ kind: "service" }), kind: "service" })).toBe(
      `/projects/${p}/services`,
    )
    expect(resultHref({ ...row({ kind: "repository" }), kind: "repository" })).toBe(
      `/projects/${p}/repositories`,
    )
    expect(resultHref({ ...row({ kind: "technology" }), kind: "technology" })).toBe(
      `/projects/${p}`,
    )
    expect(resultHref({ ...row({ kind: "command", title: "Run db:push" }), kind: "command" })).toBe(
      `/projects/${p}/documentation?tab=commands&q=Run%20db%3Apush`,
    )
    expect(resultHref({ ...row({ kind: "command", project_id: null }), kind: "command" })).toBe(
      `/knowledge?tab=commands&q=Title`,
    )
  })

  it("groups in display order and drops unknown kinds", () => {
    const results = toResults([
      row({ kind: "technology", id: "t" }),
      row({ kind: "task", id: "a" }),
      row({ kind: "secret", id: "x" }),
      row({ kind: "project", id: "p" }),
      row({ kind: "task", id: "b" }),
    ])
    expect(groupResults(results).map(([k, items]) => [k, items.map((i) => i.id)])).toEqual([
      ["project", ["p"]],
      ["task", ["a", "b"]],
      ["technology", ["t"]],
    ])
  })

  it("labels metadata in words", () => {
    expect(metaLabel("task", "in_progress")).toBe("In Progress")
    expect(metaLabel("environment", "production")).toBe("Production")
    expect(metaLabel("document", "adr")).toBe("Decision record (ADR)")
    expect(metaLabel("command", "powershell")).toBe("PowerShell")
    expect(metaLabel("document", "archived")).toBe("Archived")
    expect(metaLabel("task", null)).toBeNull()
  })

  it("splits highlighted excerpts without passing markup through", () => {
    expect(splitHighlights("Flush the ⟪Redis⟫ cache in ⟪staging⟫.")).toEqual([
      { text: "Flush the ", match: false },
      { text: "Redis", match: true },
      { text: " cache in ", match: false },
      { text: "staging", match: true },
      { text: ".", match: false },
    ])
    // Excerpts are text: HTML stays text, stray markers disappear.
    expect(splitHighlights("<b>x</b> ⟪y")).toEqual([{ text: "<b>x</b> y", match: false }])
    expect(toResults([row({ kind: "task", excerpt: "  a \n\n b  " })])[0]!.excerpt).toBe("a b")
  })
})
