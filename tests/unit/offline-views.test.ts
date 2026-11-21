import { describe, expect, it } from "vitest"

import { buildSnapshot, type RawOfflineTask } from "@/features/offline/snapshot"
import {
  projectsWithTasks,
  resolveOfflineView,
  selectProjectTasks,
  selectQueue,
  selectTaskDetail,
} from "@/features/offline/views"

/** Which part of the offline copy a URL shows, and the queues it builds (Plan P9.4). */
const T1 = "11111111-1111-4111-8111-111111111111"
const P1 = "22222222-2222-4222-8222-222222222222"

describe("resolveOfflineView", () => {
  it.each([
    ["/my-work", { kind: "queue", view: "all" }],
    ["/my-work?view=blocked", { kind: "queue", view: "blocked" }],
    ["/my-work?view=completed&page=2", { kind: "queue", view: "completed" }],
    ["/", { kind: "queue", view: "all" }],
    ["/dashboard", { kind: "queue", view: "all" }],
    ["/offline", { kind: "queue", view: "all" }],
    [`/projects/${P1}`, { kind: "project", projectId: P1 }],
    [`/projects/${P1}/tasks?view=inbox`, { kind: "project", projectId: P1 }],
    [`/tasks/${T1}`, { kind: "task", taskId: T1, editing: false }],
    [`/tasks/${T1}/edit`, { kind: "task", taskId: T1, editing: true }],
  ])("%s", (path, expected) => {
    expect(resolveOfflineView(`https://app.example${path}`)).toEqual(expected)
  })

  it.each([
    "/my-work?view=archived",
    `/projects/${P1}/environments`,
    "/tasks/new",
    "/tasks/not-a-uuid",
    "/knowledge",
    "/settings",
  ])("%s isn't in the copy", (path) => {
    expect(resolveOfflineView(`https://app.example${path}`).kind).toBe("unavailable")
  })
})

function task(id: string, extra: Partial<RawOfflineTask> = {}): RawOfflineTask {
  return {
    id,
    title: id,
    description: null,
    status: "ready",
    priority: "medium",
    due_at: null,
    next_action: null,
    blocker_details: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    completed_at: null,
    project_id: P1,
    repository_id: null,
    parent_task_id: null,
    project: { name: "Alpha" },
    repository: null,
    labels: [],
    comments: [],
    links: [],
    ...extra,
  }
}

const copy = buildSnapshot(
  {
    timeZone: "UTC",
    truncated: false,
    projects: [
      { id: P1, name: "Alpha", status: "active" },
      { id: "p-empty", name: "Empty", status: "active" },
    ],
    tasks: [
      task("low", { priority: "low" }),
      task("urgent", { priority: "urgent" }),
      task("inbox", { status: "inbox" }),
      task("blocked", { status: "blocked", blocker_details: "Waiting" }),
      task("due-late", { due_at: "2026-12-10T00:00:00Z" }),
      task("due-soon", { due_at: "2026-11-25T00:00:00Z", parent_task_id: "urgent" }),
      task("done-old", { status: "done", completed_at: "2026-11-10T00:00:00Z" }),
      task("done-new", { status: "done", completed_at: "2026-11-20T00:00:00Z" }),
    ],
    parents: [],
    dependencies: [
      {
        task: { id: "blocked", title: "blocked", status: "blocked" },
        depends_on: { id: "urgent", title: "urgent", status: "ready" },
      },
    ],
  },
  { userId: "u1", now: new Date("2026-11-21T00:00:00Z") },
)

describe("queues", () => {
  it("All open: not done, by priority then due date", () => {
    expect(selectQueue(copy, "all").map((t) => t.id)).toEqual([
      "urgent",
      "due-soon",
      "due-late",
      "inbox",
      "blocked",
      "low",
    ])
  })

  it("Upcoming: dated open tasks, soonest first", () => {
    expect(selectQueue(copy, "upcoming").map((t) => t.id)).toEqual(["due-soon", "due-late"])
  })

  it("Inbox, Blocked and Recently completed", () => {
    expect(selectQueue(copy, "inbox").map((t) => t.id)).toEqual(["inbox"])
    expect(selectQueue(copy, "blocked").map((t) => t.id)).toEqual(["blocked"])
    expect(selectQueue(copy, "completed").map((t) => t.id)).toEqual(["done-new", "done-old"])
  })

  it("a project's open and done tasks; only projects with open tasks in the nav", () => {
    const p = selectProjectTasks(copy, P1)
    expect(p.project?.name).toBe("Alpha")
    expect(p.open).toHaveLength(6)
    expect(p.done.map((t) => t.id)).toEqual(["done-new", "done-old"])
    expect(projectsWithTasks(copy)).toEqual([{ id: P1, name: "Alpha", status: "active", open: 6 }])
  })
})

describe("selectTaskDetail", () => {
  it("links parent, subtasks and dependencies both ways", () => {
    const urgent = selectTaskDetail(copy, "urgent")!
    expect(urgent.subtasks.map((s) => s.id)).toEqual(["due-soon"])
    expect(urgent.blocking.map((s) => s.id)).toEqual(["blocked"])
    expect(selectTaskDetail(copy, "due-soon")!.parent?.id).toBe("urgent")
    expect(selectTaskDetail(copy, "blocked")!.dependsOn.map((d) => d.id)).toEqual(["urgent"])
    expect(selectTaskDetail(copy, "missing")).toBeNull()
  })
})
