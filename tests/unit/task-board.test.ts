import { describe, expect, it } from "vitest"

import { boardColumns, parseTaskFilters } from "@/features/tasks/utils"

/** The board as the default view (Plan P10.1): which columns show, and which views stay lists. */
const columnsFor = (sp: Record<string, string>) => boardColumns(parseTaskFilters(sp))

describe("boardColumns", () => {
  it("shows every status for the open queue", () => {
    expect(columnsFor({})).toEqual(["inbox", "ready", "in_progress", "blocked", "review", "done"])
  })

  it("follows the view", () => {
    expect(columnsFor({ view: "inbox" })).toEqual(["inbox"])
    expect(columnsFor({ view: "blocked" })).toEqual(["blocked"])
    expect(columnsFor({ view: "upcoming" })).not.toContain("done")
  })

  it("follows a status filter, in workflow order", () => {
    expect(columnsFor({ status: "in_progress,ready" })).toEqual(["ready", "in_progress"])
  })

  it("follows the attention flags", () => {
    expect(columnsFor({ flags: "overdue" })).not.toContain("done")
    expect(columnsFor({ flags: "no-next-action" })).toEqual(["in_progress"])
    expect(columnsFor({ status: "ready", flags: "no-next-action" })).toEqual([
      "inbox",
      "ready",
      "in_progress",
      "blocked",
      "review",
      "done",
    ])
  })
})

describe("list-only views", () => {
  it("keeps Completed and Archived as lists even when the board is asked for", () => {
    expect(parseTaskFilters({ view: "completed", layout: "board" }).layout).toBe("list")
    expect(parseTaskFilters({ view: "archived" }).layout).toBe("list")
    expect(parseTaskFilters({ view: "upcoming" }).layout).toBe("board")
  })
})
