import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { fetchOfflineData } from "../../src/features/offline/fetch-snapshot"
import { buildSnapshot, MAX_COMMENTS } from "../../src/features/offline/snapshot"
import { createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * The offline copy's query (Plan P9.3), run exactly as the browser runs it, as a throwaway user:
 * what is in it, the embedded comment limit, and that RLS keeps another user's tasks out.
 */
describe("offline copy of tasks", () => {
  let a: TestUser
  let b: TestUser
  const ids: Record<string, string> = {}
  const DAY = 86_400_000

  beforeAll(async () => {
    a = await createTestUser("offline-a")
    b = await createTestUser("offline-b")
    const db = a.client

    const { data: project } = await db
      .from("projects")
      .insert({ name: "Offline project", project_type: "client" })
      .select("id")
      .single()
    ids.project = project!.id

    const task = async (title: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await db
        .from("tasks")
        .insert({ project_id: ids.project!, title, ...extra })
        .select("id")
        .single()
      expect(error).toBeNull()
      return data!.id
    }
    ids.parent = await task("Parent, done", { status: "done" })
    ids.open = await task("Open task", {
      status: "in_progress",
      priority: "urgent",
      next_action: "Write the migration",
      description: "Some **markdown**",
      parent_task_id: ids.parent,
    })
    ids.done = await task("Recently done", { status: "done" })
    ids.archived = await task("Archived task")
    await db.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", ids.archived)
    ids.blocker = await task("Blocking task", { status: "ready" })
    await db
      .from("task_dependencies")
      .insert({ task_id: ids.open, depends_on_task_id: ids.blocker, project_id: ids.project })

    const { data: label } = await db
      .from("task_labels")
      .insert({ name: "backend", color: "blue" })
      .select("id")
      .single()
    await db.from("task_label_links").insert({ task_id: ids.open, label_id: label!.id })

    // More comments than the copy keeps: it must hold the most recent ones.
    for (let i = 1; i <= MAX_COMMENTS + 2; i++) {
      const { error } = await db
        .from("task_comments")
        .insert({ task_id: ids.open, content: `Comment ${String(i).padStart(2, "0")}` })
      expect(error).toBeNull()
    }
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  it("holds open and recently done tasks with what the detail shows", async () => {
    const now = new Date()
    const raw = await fetchOfflineData(a.client, a.id, now)
    const snapshot = buildSnapshot(raw, { userId: a.id, now })

    const titles = snapshot.tasks.map((t) => t.title).sort()
    expect(titles).toEqual(["Blocking task", "Open task", "Parent, done", "Recently done"])
    expect(snapshot.truncated).toBe(false)
    expect(snapshot.projects.map((p) => p.name)).toEqual(["Offline project"])

    const open = snapshot.tasks.find((t) => t.id === ids.open)!
    expect(open).toMatchObject({
      next_action: "Write the migration",
      description: "Some **markdown**",
      project: { name: "Offline project" },
    })
    expect(open).not.toHaveProperty("owner_id")
    expect(open).not.toHaveProperty("search_vector")
    expect(open.labels.map((l) => l.name)).toEqual(["backend"])
    expect(open.comments).toHaveLength(MAX_COMMENTS)
    expect(open.comments[0]!.content).toBe("Comment 03")
    expect(open.comments.at(-1)!.content).toBe(`Comment ${MAX_COMMENTS + 2}`)
    expect(snapshot.dependencies).toEqual([
      {
        task: { id: ids.open, title: "Open task", status: "in_progress" },
        dependsOn: { id: ids.blocker, title: "Blocking task", status: "ready" },
      },
    ])
  })

  it("drops done tasks outside the window and names parents that aren't in the copy", async () => {
    const later = new Date(Date.now() + 15 * DAY)
    const snapshot = buildSnapshot(await fetchOfflineData(a.client, a.id, later), {
      userId: a.id,
      now: later,
    })
    expect(snapshot.tasks.map((t) => t.title).sort()).toEqual(["Blocking task", "Open task"])
    expect(snapshot.refs).toEqual([{ id: ids.parent, title: "Parent, done", status: "done" }])
  })

  it("never contains another user's tasks", async () => {
    const raw = await fetchOfflineData(b.client, b.id)
    expect(raw.tasks).toEqual([])
    expect(raw.projects).toEqual([])
    expect(raw.dependencies).toEqual([])
  })
})
