import { describe, expect, it } from "vitest"

import {
  belongsTo,
  buildSnapshot,
  completedSince,
  isSnapshotUsable,
  MAX_COMMENTS,
  OFFLINE_SCHEMA_VERSION,
  type RawOfflineData,
  type RawOfflineTask,
} from "@/features/offline/snapshot"

/** The offline copy's shaping and checks (Plan P9.3). */
const now = new Date("2026-11-21T10:00:00Z")
const DAY = 86_400_000

function task(id: string, extra: Partial<RawOfflineTask> = {}): RawOfflineTask {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    status: "ready",
    priority: "medium",
    due_at: null,
    next_action: null,
    blocker_details: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    completed_at: null,
    project_id: "p1",
    repository_id: null,
    parent_task_id: null,
    project: { name: "Project" },
    repository: null,
    labels: [],
    comments: [],
    links: [],
    ...extra,
  }
}

function raw(extra: Partial<RawOfflineData> = {}): RawOfflineData {
  return {
    timeZone: "Asia/Karachi",
    truncated: false,
    projects: [{ id: "p1", name: "Project", status: "active" }],
    tasks: [task("t1")],
    parents: [],
    dependencies: [],
    ...extra,
  }
}

describe("buildSnapshot", () => {
  it("stamps the user, time, version and time zone", () => {
    const s = buildSnapshot(raw(), { userId: "u1", now })
    expect(s).toMatchObject({
      version: OFFLINE_SCHEMA_VERSION,
      userId: "u1",
      syncedAt: now.toISOString(),
      timeZone: "Asia/Karachi",
      truncated: false,
    })
  })

  it("flattens and sorts labels, and drops dangling label links", () => {
    const s = buildSnapshot(
      raw({
        tasks: [
          task("t1", {
            labels: [
              { label: { id: "l2", name: "web", color: "green" } },
              { label: null },
              { label: { id: "l1", name: "api", color: "not-a-colour" } },
            ],
          }),
        ],
      }),
      { userId: "u1", now },
    )
    expect(s.tasks[0]!.labels.map((l) => l.name)).toEqual(["api", "web"])
    expect(s.tasks[0]!.labels[0]!.color).not.toBe("not-a-colour")
  })

  it("keeps the most recent comments, oldest first", () => {
    const comments = Array.from({ length: MAX_COMMENTS + 5 }, (_, i) => ({
      id: `c${i}`,
      content: `Comment ${i}`,
      created_at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
      updated_at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
    })).reverse()
    const s = buildSnapshot(raw({ tasks: [task("t1", { comments })] }), { userId: "u1", now })
    const kept = s.tasks[0]!.comments
    expect(kept).toHaveLength(MAX_COMMENTS)
    expect(kept[0]!.content).toBe("Comment 5")
    expect(kept.at(-1)!.content).toBe(`Comment ${MAX_COMMENTS + 4}`)
  })

  it("keeps only parents missing from the copy, and dependencies that touch it", () => {
    const ref = (id: string) => ({ id, title: id, status: "ready" as const })
    const s = buildSnapshot(
      raw({
        tasks: [task("t1", { parent_task_id: "gone" }), task("t2", { parent_task_id: "t1" })],
        parents: [ref("gone"), ref("unrelated")],
        dependencies: [
          { task: ref("t1"), depends_on: ref("elsewhere") },
          { task: ref("x"), depends_on: ref("y") },
          { task: null, depends_on: ref("t1") },
        ],
      }),
      { userId: "u1", now },
    )
    expect(s.refs.map((r) => r.id)).toEqual(["gone"])
    expect(s.dependencies).toEqual([{ task: ref("t1"), dependsOn: ref("elsewhere") }])
  })
})

describe("isSnapshotUsable", () => {
  const good = () => buildSnapshot(raw(), { userId: "u1", now })

  it("accepts a fresh copy", () => {
    expect(isSnapshotUsable(good(), now)).toBe(true)
    expect(isSnapshotUsable(good(), new Date(now.getTime() + 29 * DAY))).toBe(true)
  })

  it("rejects a copy older than 30 days, or dated in the future", () => {
    expect(isSnapshotUsable(good(), new Date(now.getTime() + 31 * DAY))).toBe(false)
    expect(isSnapshotUsable(good(), new Date(now.getTime() - 2 * DAY))).toBe(false)
  })

  it("rejects other versions and malformed values", () => {
    expect(isSnapshotUsable({ ...good(), version: 99 }, now)).toBe(false)
    expect(isSnapshotUsable({ ...good(), tasks: "nope" }, now)).toBe(false)
    expect(isSnapshotUsable({ ...good(), syncedAt: "yesterday" }, now)).toBe(false)
    expect(isSnapshotUsable(null, now)).toBe(false)
    expect(isSnapshotUsable("copy", now)).toBe(false)
  })
})

describe("belongsTo", () => {
  it("matches the user id only", () => {
    const s = buildSnapshot(raw(), { userId: "u1", now })
    expect(belongsTo(s, "u1")).toBe(true)
    expect(belongsTo(s, "u2")).toBe(false)
    expect(belongsTo({ version: 0, userId: "u1" }, "u1")).toBe(true)
    expect(belongsTo(null, "u1")).toBe(false)
  })
})

describe("completedSince", () => {
  it("is 14 days before now", () => {
    expect(completedSince(now)).toBe("2026-11-07T10:00:00.000Z")
  })
})
