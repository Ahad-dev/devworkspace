import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  BLOCKING_SELECT,
  DEPENDS_ON_SELECT,
  TASK_DETAIL_SELECT,
  TASK_LIST_SELECT,
} from "../../src/features/tasks/selects"
import type { TablesUpdate } from "../../src/types/database.types"
import { createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * Phase 3 (Spec FR-06/FR-13; Plan P3.1–P3.4, P3.12): tasks, links, labels, comments, dependencies.
 * Everything here is enforced by the database: RLS, composite FKs, checks and triggers.
 */
describe("tasks", () => {
  let a: TestUser
  let b: TestUser
  let p1: string
  let p2: string

  beforeAll(async () => {
    a = await createTestUser("p3a")
    b = await createTestUser("p3b")
    p1 = await project(a, "Tasks one")
    p2 = await project(a, "Tasks two")
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  async function project(user: TestUser, name: string) {
    const { data, error } = await user.client
      .from("projects")
      .insert({ name, project_type: "personal" })
      .select("id")
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function task(
    user: TestUser,
    projectId: string,
    title: string,
    extra: Record<string, unknown> = {},
  ) {
    const { data, error } = await user.client
      .from("tasks")
      .insert({ project_id: projectId, title, ...extra })
      .select("id, status, priority, owner_id, completed_at, blocker_details")
      .single()
    expect(error).toBeNull()
    return data!
  }

  describe("basics and isolation", () => {
    it("creates a task with Inbox/Medium defaults, owned by the caller", async () => {
      const t = await task(a, p1, "Write the spec")
      expect(t).toMatchObject({ status: "inbox", priority: "medium", owner_id: a.id })
    })

    it("hides tasks from other users and ignores their writes", async () => {
      const t = await task(a, p1, "Private task")
      expect((await b.client.from("tasks").select("id").eq("id", t.id)).data).toEqual([])
      expect(
        (await b.client.from("tasks").update({ title: "x" }).eq("id", t.id).select("id")).data,
      ).toEqual([])
      expect((await b.client.from("tasks").delete().eq("id", t.id).select("id")).data).toEqual([])
    })

    it("cannot add a task to another user's project", async () => {
      const { error } = await b.client.from("tasks").insert({ project_id: p1, title: "intrude" })
      expect(error?.code).toBe("23503")
    })

    it("keeps owner, project and completion time out of client control", async () => {
      const t = await task(a, p1, "Locked fields")
      for (const patch of [
        { owner_id: b.id },
        { project_id: p2 },
        { completed_at: new Date().toISOString() },
      ]) {
        const { error } = await a.client
          .from("tasks")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columns outside the update grant
          .update(patch as any)
          .eq("id", t.id)
        expect(error?.code).toBe("42501")
      }
    })
  })

  describe("same-project integrity", () => {
    it("rejects a repository from another project", async () => {
      const repo = await a.client
        .from("repositories")
        .insert({ project_id: p2, name: "other-repo" })
        .select("id")
        .single()
      const { error } = await a.client
        .from("tasks")
        .insert({ project_id: p1, title: "Wrong repo", repository_id: repo.data!.id })
      expect(error?.code).toBe("23503")
    })

    it("rejects a parent task from another project", async () => {
      const parent = await task(a, p2, "Parent elsewhere")
      const { error } = await a.client
        .from("tasks")
        .insert({ project_id: p1, title: "Child", parent_task_id: parent.id })
      expect(error?.code).toBe("23503")
    })

    it("rejects parent cycles and self-parenting", async () => {
      const top = await task(a, p1, "Top")
      const mid = await task(a, p1, "Mid", { parent_task_id: top.id })
      const leaf = await task(a, p1, "Leaf", { parent_task_id: mid.id })

      const cycle = await a.client
        .from("tasks")
        .update({ parent_task_id: leaf.id })
        .eq("id", top.id)
      expect(cycle.error?.code).toBe("23514")

      const self = await a.client.from("tasks").update({ parent_task_id: top.id }).eq("id", top.id)
      expect(self.error?.code).toBe("23514")
    })

    it("won't delete a task that still has subtasks", async () => {
      const parent = await task(a, p1, "Has children")
      const child = await task(a, p1, "Child task", { parent_task_id: parent.id })
      expect((await a.client.from("tasks").delete().eq("id", parent.id)).error?.code).toBe("23503")
      expect((await a.client.from("tasks").delete().eq("id", child.id)).error).toBeNull()
      expect((await a.client.from("tasks").delete().eq("id", parent.id)).error).toBeNull()
    })
  })

  describe("status rules", () => {
    it("requires blocker details for Blocked and clears them on unblock", async () => {
      const t = await task(a, p1, "Blockable")
      const missing = await a.client.from("tasks").update({ status: "blocked" }).eq("id", t.id)
      expect(missing.error?.code).toBe("23514")

      const blocked = await a.client
        .from("tasks")
        .update({ status: "blocked", blocker_details: "Waiting for API keys from client" })
        .eq("id", t.id)
        .select("blocker_details")
        .single()
      expect(blocked.data?.blocker_details).toBe("Waiting for API keys from client")

      const unblocked = await a.client
        .from("tasks")
        .update({ status: "ready" })
        .eq("id", t.id)
        .select("blocker_details")
        .single()
      expect(unblocked.data?.blocker_details).toBeNull()
    })

    it("sets completed_at on Done and clears it on reopen", async () => {
      const t = await task(a, p1, "Finishable")
      const done = await a.client
        .from("tasks")
        .update({ status: "done" })
        .eq("id", t.id)
        .select("completed_at")
        .single()
      expect(done.data?.completed_at).not.toBeNull()

      const reopened = await a.client
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", t.id)
        .select("completed_at")
        .single()
      expect(reopened.data?.completed_at).toBeNull()

      const createdDone = await task(a, p1, "Born done", { status: "done" })
      expect(createdDone.completed_at).not.toBeNull()
    })
  })

  describe("dependencies", () => {
    it("rejects self, cross-project and cyclic dependencies", async () => {
      const x = await task(a, p1, "X")
      const y = await task(a, p1, "Y")
      const z = await task(a, p1, "Z")
      const other = await task(a, p2, "Other project")

      const dep = (taskId: string, dependsOn: string, projectId = p1) =>
        a.client
          .from("task_dependencies")
          .insert({ task_id: taskId, depends_on_task_id: dependsOn, project_id: projectId })

      expect((await dep(x.id, x.id)).error?.code).toBe("23514")
      expect((await dep(x.id, other.id)).error?.code).toBe("23503")

      expect((await dep(x.id, y.id)).error).toBeNull()
      expect((await dep(y.id, z.id)).error).toBeNull()
      const cycle = await dep(z.id, x.id)
      expect(cycle.error?.code).toBe("23514")
      expect(cycle.error?.hint).toBe("task_dependency_cycle")
    })

    it("cannot depend on another user's tasks", async () => {
      const mine = await task(a, p1, "Mine")
      const theirsProject = await project(b, "B project")
      const theirs = await task(b, theirsProject, "Theirs")
      const { error } = await a.client
        .from("task_dependencies")
        .insert({ task_id: mine.id, depends_on_task_id: theirs.id, project_id: p1 })
      expect(error?.code).toBe("23503")
    })
  })

  describe("labels, links and comments", () => {
    it("manages labels per owner and blocks cross-owner links", async () => {
      const label = await a.client
        .from("task_labels")
        .insert({ name: "Bug", color: "red" })
        .select("id")
        .single()
      expect(label.error).toBeNull()
      expect((await a.client.from("task_labels").insert({ name: "bug" })).error?.code).toBe("23505")
      expect(
        (await a.client.from("task_labels").insert({ name: "Weird", color: "#ff00ff" })).error
          ?.code,
      ).toBe("23514")

      const t = await task(a, p1, "Labelled")
      const link = await a.client
        .from("task_label_links")
        .insert({ task_id: t.id, label_id: label.data!.id })
      expect(link.error).toBeNull()

      // B can't attach their own label to A's task.
      const bLabel = await b.client
        .from("task_labels")
        .insert({ name: "Mine" })
        .select("id")
        .single()
      const cross = await b.client
        .from("task_label_links")
        .insert({ task_id: t.id, label_id: bLabel.data!.id })
      expect(cross.error?.code).toBe("23503")
      expect(
        (await b.client.from("task_labels").select("id").eq("id", label.data!.id)).data,
      ).toEqual([])
    })

    it("rejects credential URLs in task links", async () => {
      const t = await task(a, p1, "With links")
      expect(
        (
          await a.client
            .from("task_links")
            .insert({ task_id: t.id, label: "PR", url: "https://github.com/a/b/pull/1" })
        ).error,
      ).toBeNull()
      expect(
        (
          await a.client
            .from("task_links")
            .insert({ task_id: t.id, label: "Bad", url: "https://u:p@x.com" })
        ).error?.code,
      ).toBe("23514")
    })

    it("keeps comments private and logs them without their content", async () => {
      const t = await task(a, p1, "Discussed")
      const c = await a.client
        .from("task_comments")
        .insert({ task_id: t.id, content: "Tried the staging deploy, failing on migrations." })
        .select("id")
        .single()
      expect(c.error).toBeNull()
      expect((await b.client.from("task_comments").select("id").eq("task_id", t.id)).data).toEqual(
        [],
      )

      const ev = await a.client
        .from("activity_events")
        .select("event_type, metadata")
        .eq("task_id", t.id)
        .eq("event_type", "task.comment_added")
      expect(ev.data).toHaveLength(1)
      expect(JSON.stringify(ev.data)).not.toContain("staging deploy")
    })
  })

  describe("app selects (composite-FK embeds)", () => {
    it("embeds project, repository, labels, dependencies and filters by view", async () => {
      const p = await project(a, "Embeds")
      const repo = await a.client
        .from("repositories")
        .insert({ project_id: p, name: "embed-repo" })
        .select("id")
        .single()
      const label = await a.client
        .from("task_labels")
        .insert({ name: "Embed label", color: "blue" })
        .select("id")
        .single()
      const t = await task(a, p, "Embedded", {
        repository_id: repo.data!.id,
        status: "in_progress",
        priority: "high",
      })
      const dep = await task(a, p, "Prerequisite", { status: "ready" })
      await a.client.from("task_label_links").insert({ task_id: t.id, label_id: label.data!.id })
      await a.client
        .from("task_dependencies")
        .insert({ task_id: t.id, depends_on_task_id: dep.id, project_id: p })

      const list = await a.client
        .from("tasks")
        .select(TASK_LIST_SELECT, { count: "exact" })
        .eq("project_id", p)
        .is("archived_at", null)
        .neq("status", "done")
        .order("priority")
        .order("id")
        .range(0, 49)
      expect(list.error).toBeNull()
      expect(list.count).toBe(2)
      // Enum order: urgent → low, so the high-priority task comes first.
      expect(list.data?.[0]).toMatchObject({
        title: "Embedded",
        project: { name: "Embeds" },
        repository: { name: "embed-repo" },
        labels: [{ label: { name: "Embed label", color: "blue" } }],
      })
      expect(list.data?.[1]?.repository).toBeNull()

      const detail = await a.client.from("tasks").select(TASK_DETAIL_SELECT).eq("id", t.id).single()
      expect(detail.error).toBeNull()
      expect(detail.data?.project).toMatchObject({ id: p, name: "Embeds" })

      const dependsOn = await a.client
        .from("task_dependencies")
        .select(DEPENDS_ON_SELECT)
        .eq("task_id", t.id)
      expect(dependsOn.data).toEqual([
        { task: { id: dep.id, title: "Prerequisite", status: "ready" } },
      ])
      const blocking = await a.client
        .from("task_dependencies")
        .select(BLOCKING_SELECT)
        .eq("depends_on_task_id", dep.id)
      expect(blocking.data?.[0]?.task?.id).toBe(t.id)

      // B sees nothing through the same selects.
      const asB = await b.client.from("tasks").select(TASK_LIST_SELECT).eq("project_id", p)
      expect(asB.data).toEqual([])
    })
  })

  describe("activity and summaries", () => {
    it("records the task lifecycle without free-text values", async () => {
      const t = await task(a, p1, "Tracked task")
      const upd = (patch: TablesUpdate<"tasks">) =>
        a.client.from("tasks").update(patch).eq("id", t.id)
      await upd({ status: "ready" })
      await upd({ priority: "urgent" })
      await upd({ next_action: "Open the migration file and fix the FK" })
      await upd({ status: "done" })
      await upd({ status: "review" })
      await upd({ archived_at: new Date().toISOString() })

      const { data } = await a.client
        .from("activity_events")
        .select("event_type, metadata")
        .eq("task_id", t.id)
        .order("created_at", { ascending: true })
      expect(data?.map((e) => e.event_type)).toEqual([
        "task.created",
        "task.status_changed",
        "task.priority_changed",
        "task.updated",
        "task.completed",
        "task.reopened",
        "task.archived",
      ])
      expect(data?.[3]?.metadata).toMatchObject({ changed: ["next_action"] })
      expect(JSON.stringify(data)).not.toContain("migration file")
    })

    it("counts tasks per project and cascades on project delete", async () => {
      const p = await project(a, "Counted tasks")
      const parent = await task(a, p, "Open", { status: "ready" })
      await task(a, p, "Child", { parent_task_id: parent.id })
      await task(a, p, "Shipped", { status: "done" })
      const archived = await task(a, p, "Old")
      await a.client
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", archived.id)
      const x = await task(a, p, "Dep A")
      const y = await task(a, p, "Dep B")
      await a.client
        .from("task_dependencies")
        .insert({ task_id: x.id, depends_on_task_id: y.id, project_id: p })

      const summary = await a.client
        .from("project_summaries")
        .select("task_count, done_task_count, open_task_count")
        .eq("id", p)
        .single()
      // 5 non-archived: Open(ready), Child(inbox), Shipped(done), Dep A(inbox), Dep B(inbox)
      expect(summary.data).toEqual({ task_count: 5, done_task_count: 1, open_task_count: 1 })

      const del = await a.client.from("projects").delete().eq("id", p)
      expect(del.error).toBeNull()
      expect((await a.client.from("tasks").select("id").eq("project_id", p)).data).toEqual([])
    })
  })
})
