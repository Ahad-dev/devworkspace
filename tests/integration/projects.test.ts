import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * Phase 2 tables (Spec FR-03/04/05/13; Plan P2.1–P2.5, P2.11): owner-only RLS, same-owner and
 * same-project integrity via composite FKs, column grants, URL rules, archive invariant,
 * cascade/unlink on delete, activity history, and the project_summaries view.
 */
describe("projects, repositories, technologies, activity", () => {
  let a: TestUser
  let b: TestUser

  beforeAll(async () => {
    a = await createTestUser("p2a")
    b = await createTestUser("p2b")
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  async function createProject(user: TestUser, name: string) {
    const { data, error } = await user.client
      .from("projects")
      .insert({ name, project_type: "personal" })
      .select("id, owner_id, status, archived_at")
      .single()
    expect(error).toBeNull()
    return data!
  }

  async function addRepo(user: TestUser, projectId: string, name: string, remoteUrl?: string) {
    return user.client
      .from("repositories")
      .insert({ project_id: projectId, name, remote_url: remoteUrl ?? null })
      .select("id")
      .single()
  }

  describe("projects", () => {
    it("creates a project with only name and type, owned by the caller", async () => {
      const p = await createProject(a, "Alpha")
      expect(p.owner_id).toBe(a.id)
      expect(p.status).toBe("active")
      expect(p.archived_at).toBeNull()
    })

    it("never lets a client choose owner_id", async () => {
      const { error } = await a.client
        .from("projects")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately bypassing types
        .insert({ name: "Spoof", project_type: "personal", owner_id: b.id } as any)
      expect(error?.code).toBe("42501")
    })

    it("hides a project from other users and ignores their writes", async () => {
      const p = await createProject(a, "Private")

      const read = await b.client.from("projects").select("id").eq("id", p.id)
      expect(read.data).toEqual([])

      const upd = await b.client
        .from("projects")
        .update({ name: "pwned" })
        .eq("id", p.id)
        .select("id")
      expect(upd.data).toEqual([])

      const del = await b.client.from("projects").delete().eq("id", p.id).select("id")
      expect(del.data).toEqual([])

      const still = await a.client.from("projects").select("name").eq("id", p.id).single()
      expect(still.data?.name).toBe("Private")
    })

    it("refuses anonymous access", async () => {
      const { error } = await anonClient().from("projects").select("id")
      expect(error?.code).toBe("42501")
    })

    it("keeps archived_at in sync with status", async () => {
      const p = await createProject(a, "Archivable")

      const archived = await a.client
        .from("projects")
        .update({ status: "archived" })
        .eq("id", p.id)
        .select("status, archived_at")
        .single()
      expect(archived.data?.status).toBe("archived")
      expect(archived.data?.archived_at).not.toBeNull()

      const restored = await a.client
        .from("projects")
        .update({ status: "active" })
        .eq("id", p.id)
        .select("status, archived_at")
        .single()
      expect(restored.data?.archived_at).toBeNull()
    })

    it("does not allow setting archived_at directly", async () => {
      const p = await createProject(a, "NoDirectArchive")
      const { error } = await a.client
        .from("projects")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column isn't in the update grant
        .update({ archived_at: new Date().toISOString() } as any)
        .eq("id", p.id)
      expect(error?.code).toBe("42501")
    })

    it.each([
      ["https://user:secret@example.com"],
      ["https://ghp_token123@github.com/owner/repo"],
      ["javascript:alert(1)"],
      ["ftp://example.com"],
      ["https://exa mple.com"],
    ])("rejects unsafe project URL %s", async (url) => {
      const { error } = await a.client
        .from("projects")
        .insert({ name: "Bad URL", project_type: "personal", project_url: url })
      expect(error?.code).toBe("23514")
    })

    it("accepts a normal https URL and rejects target before start date", async () => {
      const ok = await a.client.from("projects").insert({
        name: "Dated",
        project_type: "client",
        project_url: "https://example.com/app?tab=1#top",
        start_date: "2026-01-01",
        target_date: "2026-06-30",
      })
      expect(ok.error).toBeNull()

      const bad = await a.client.from("projects").insert({
        name: "Backwards",
        project_type: "client",
        start_date: "2026-06-30",
        target_date: "2026-01-01",
      })
      expect(bad.error?.code).toBe("23514")
    })
  })

  describe("repositories", () => {
    it.each([
      ["https://github.com/owner/repo.git"],
      ["git@github.com:owner/repo.git"],
      ["ssh://git@bitbucket.org:7999/team/repo.git"],
    ])("accepts remote %s", async (remote) => {
      const p = await createProject(a, `Remote ${remote.slice(0, 12)}`)
      const { error } = await addRepo(a, p.id, "web", remote)
      expect(error).toBeNull()
    })

    it.each([["https://ghp_token@github.com/owner/repo"], ["https://u:p@gitlab.com/g/r.git"]])(
      "rejects a remote with credentials %s",
      async (remote) => {
        const p = await createProject(a, "Cred remote")
        const { error } = await addRepo(a, p.id, "web", remote)
        expect(error?.code).toBe("23514")
      },
    )

    it("cannot attach a repository to another user's project", async () => {
      const p = await createProject(a, "Owned by A")
      const { error } = await addRepo(b, p.id, "intruder")
      // owner_id defaults to B, so (project_id, owner_id) matches no project: FK violation.
      expect(error?.code).toBe("23503")
    })

    it("rejects duplicate names in one project, case-insensitively", async () => {
      const p = await createProject(a, "Dupes")
      expect((await addRepo(a, p.id, "API")).error).toBeNull()
      expect((await addRepo(a, p.id, "api")).error?.code).toBe("23505")
    })

    it("does not allow moving a repository to another project", async () => {
      const p1 = await createProject(a, "Move from")
      const p2 = await createProject(a, "Move to")
      const repo = await addRepo(a, p1.id, "movable")
      const { error } = await a.client
        .from("repositories")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- project_id isn't in the update grant
        .update({ project_id: p2.id } as any)
        .eq("id", repo.data!.id)
      expect(error?.code).toBe("42501")
    })
  })

  describe("technologies", () => {
    it("links a technology to a repository in the same project only", async () => {
      const p1 = await createProject(a, "Tech one")
      const p2 = await createProject(a, "Tech two")
      const repoInP2 = await addRepo(a, p2.id, "other-repo")

      const cross = await a.client
        .from("project_technologies")
        .insert({ project_id: p1.id, repository_id: repoInP2.data!.id, name: "React" })
      expect(cross.error?.code).toBe("23503")
    })

    it("unlinks (not deletes) technologies when their repository is removed", async () => {
      const p = await createProject(a, "Unlink")
      const repo = await addRepo(a, p.id, "frontend")
      const tech = await a.client
        .from("project_technologies")
        .insert({
          project_id: p.id,
          repository_id: repo.data!.id,
          name: "Next.js",
          category: "frontend",
        })
        .select("id")
        .single()
      expect(tech.error).toBeNull()

      await a.client.from("repositories").delete().eq("id", repo.data!.id)

      const after = await a.client
        .from("project_technologies")
        .select("repository_id, name")
        .eq("id", tech.data!.id)
        .single()
      expect(after.data).toEqual({ repository_id: null, name: "Next.js" })
    })

    it("rejects the same technology twice in a project", async () => {
      const p = await createProject(a, "Tech dupes")
      const first = await a.client
        .from("project_technologies")
        .insert({ project_id: p.id, name: "PostgreSQL" })
      expect(first.error).toBeNull()
      const again = await a.client
        .from("project_technologies")
        .insert({ project_id: p.id, name: "postgresql" })
      expect(again.error?.code).toBe("23505")
    })
  })

  describe("summaries, cascade and activity", () => {
    it("counts repositories and technologies per project for the owner only", async () => {
      const p = await createProject(a, "Counted")
      await addRepo(a, p.id, "one")
      await addRepo(a, p.id, "two")
      await a.client.from("project_technologies").insert({ project_id: p.id, name: "TypeScript" })

      const mine = await a.client
        .from("project_summaries")
        .select("repository_count, technology_count")
        .eq("id", p.id)
        .single()
      expect(mine.data).toEqual({ repository_count: 2, technology_count: 1 })

      const theirs = await b.client.from("project_summaries").select("id").eq("id", p.id)
      expect(theirs.data).toEqual([])
    })

    it("records project, repository and technology activity", async () => {
      const p = await createProject(a, "Tracked")
      await a.client.from("projects").update({ description: "now described" }).eq("id", p.id)
      await a.client.from("projects").update({ status: "archived" }).eq("id", p.id)
      await a.client.from("projects").update({ status: "active" }).eq("id", p.id)
      await addRepo(a, p.id, "tracked-repo")
      await a.client.from("project_technologies").insert({ project_id: p.id, name: "Vitest" })

      const { data } = await a.client
        .from("activity_events")
        .select("event_type, metadata")
        .eq("project_id", p.id)
        .order("created_at", { ascending: true })
      const types = data?.map((e) => e.event_type)
      expect(types).toEqual([
        "project.created",
        "project.updated",
        "project.archived",
        "project.restored",
        "repository.added",
        "technology.added",
      ])
      // Updates record which fields changed, never their values.
      expect(data?.[1]?.metadata).toMatchObject({ changed: ["description"] })
      expect(JSON.stringify(data)).not.toContain("now described")
    })

    it("keeps activity private and read-only", async () => {
      const theirs = await b.client.from("activity_events").select("id").eq("owner_id", a.id)
      expect(theirs.data).toEqual([])

      const insert = await a.client
        .from("activity_events")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- no insert grant exists
        .insert({ owner_id: a.id, event_type: "project.created", summary: "forged" } as any)
      expect(insert.error?.code).toBe("42501")
    })

    it("deleting a project removes its children and keeps a deletion record", async () => {
      const p = await createProject(a, "Doomed")
      const repo = await addRepo(a, p.id, "doomed-repo")
      await a.client.from("project_technologies").insert({ project_id: p.id, name: "Go" })

      const del = await a.client.from("projects").delete().eq("id", p.id)
      expect(del.error).toBeNull()

      const repos = await a.client.from("repositories").select("id").eq("id", repo.data!.id)
      expect(repos.data).toEqual([])
      const techs = await a.client.from("project_technologies").select("id").eq("project_id", p.id)
      expect(techs.data).toEqual([])

      const deleted = await a.client
        .from("activity_events")
        .select("event_type, project_id, metadata")
        .eq("event_type", "project.deleted")
        .contains("metadata", { project_id: p.id })
      expect(deleted.data).toHaveLength(1)
      expect(deleted.data?.[0]?.project_id).toBeNull()

      // Earlier history survives with project_id cleared; no per-child "removed" noise.
      const removed = await a.client
        .from("activity_events")
        .select("event_type")
        .eq("event_type", "repository.removed")
        .contains("metadata", { repository_id: repo.data!.id })
      expect(removed.data).toEqual([])
    })
  })
})
