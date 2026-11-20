import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * Phase 7 (Spec FR-02, FR-12; Plan P7.1, P7.4, P7.8): dashboard counts match a known fixture and
 * global search finds every kind of record for its owner only.
 */
describe("dashboard summary and global search", () => {
  let a: TestUser
  let b: TestUser
  let project: string
  const day = 86_400_000

  beforeAll(async () => {
    a = await createTestUser("p7a")
    b = await createTestUser("p7b")
    project = await insert(a, "projects", {
      name: "Quokka Portal",
      project_type: "client",
      description: "Customer portal with marsupial theming",
    })
    await insert(a, "projects", { name: "Old thing", project_type: "client", status: "completed" })

    const past = new Date(Date.now() - 2 * day).toISOString()
    const future = new Date(Date.now() + 3 * day).toISOString()
    const tasks: Record<string, unknown>[] = [
      { title: "Triage me", status: "inbox" },
      { title: "Ready one", status: "ready", due_at: future },
      { title: "Ready but late", status: "ready", due_at: past },
      {
        title: "Doing with plan",
        status: "in_progress",
        next_action: "Write the zygomorphic parser",
      },
      { title: "Doing without plan", status: "in_progress" },
      { title: "Stuck", status: "blocked", blocker_details: "Waiting on API keys from the client" },
      { title: "Check me", status: "review" },
      { title: "Done late", status: "done", due_at: past },
    ]
    for (const t of tasks) await insert(a, "tasks", { project_id: project, ...t })
    const archived = await insert(a, "tasks", {
      project_id: project,
      title: "Archived ready",
      status: "ready",
      due_at: past,
    })
    await a.client
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", archived)

    const reviewed = await insert(a, "environments", {
      project_id: project,
      name: "Production",
      environment_type: "production",
      notes: "Hosted on Fly with a wombat sidecar",
    })
    await a.client
      .from("environments")
      .update({ last_reviewed_at: new Date().toISOString() })
      .eq("id", reviewed)
    await insert(a, "environments", {
      project_id: project,
      name: "Staging",
      environment_type: "staging",
    })
    await insert(a, "environments", {
      project_id: project,
      name: "Flagged",
      environment_type: "custom",
      status: "needs_review",
    })
    await insert(a, "environments", {
      project_id: project,
      name: "Retired",
      environment_type: "custom",
      status: "archived",
    })

    await insert(a, "environment_variables", {
      project_id: project,
      environment_id: reviewed,
      name: "NUMBAT_API_URL",
    })
    const service = await insert(a, "project_services", {
      project_id: project,
      name: "Cache",
      category: "cache",
      provider: "Upstash",
    })
    await insert(a, "service_instances", {
      project_id: project,
      project_service_id: service,
      environment_id: reviewed,
      resource_name: "quokka-redis-prod",
    })
    await insert(a, "repositories", {
      project_id: project,
      name: "web",
      remote_url: "https://github.com/acme/platypus-web",
    })
    await insert(a, "project_technologies", {
      project_id: project,
      name: "Echidna ORM",
      category: "backend",
    })
    await insert(a, "documents", {
      project_id: project,
      title: "Rollback runbook",
      content_markdown: "Promote the previous build, then check the bilby queue.",
    })
    await insert(a, "command_snippets", {
      title: "Ping cache",
      command_text: "redis-cli -u $WALLABY_URL ping",
    })
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  async function insert(user: TestUser, table: string, row: Record<string, unknown>) {
    const { data, error } = await user.client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(table as any)
      .insert(row)
      .select("id")
      .single()
    expect(error, `${table}: ${error?.message}`).toBeNull()
    return (data as unknown as { id: string }).id
  }

  async function search(user: TestUser, q: string, limit = 5) {
    const { data, error } = await user.client.rpc("global_search", { p_query: q, p_limit: limit })
    expect(error).toBeNull()
    return data ?? []
  }

  it("counts the dashboard from the owner's live tasks and environments", async () => {
    const { data, error } = await a.client.rpc("dashboard_summary")
    expect(error).toBeNull()
    expect(data?.[0]).toEqual({
      inbox: 1,
      ready: 2,
      in_progress: 2,
      blocked: 1,
      review: 1,
      // Ready-but-late only: done and archived tasks are never overdue.
      overdue: 1,
      missing_next_action: 1,
      // Never reviewed (Staging) and marked needs review (Flagged); not reviewed or archived ones.
      environments_needing_review: 2,
      active_projects: 1,
    })
  })

  it("updates when a task moves", async () => {
    const { data: t } = await a.client.from("tasks").select("id").eq("title", "Triage me").single()
    await a.client.from("tasks").update({ status: "ready" }).eq("id", t!.id)
    const { data } = await a.client.rpc("dashboard_summary")
    expect(data?.[0]).toMatchObject({ inbox: 0, ready: 3 })
    await a.client.from("tasks").update({ status: "inbox" }).eq("id", t!.id)
  })

  it("finds every kind of record with project context", async () => {
    const cases: [string, string, string][] = [
      ["marsupial", "project", "Quokka Portal"],
      ["zygomorphic", "task", "Doing with plan"],
      ["bilby", "document", "Rollback runbook"],
      ["WALLABY", "command", "Ping cache"],
      ["wombat", "environment", "Production"],
      ["NUMBAT_API", "variable", "NUMBAT_API_URL"],
      ["quokka-redis", "service", "Cache"],
      ["platypus", "repository", "web"],
      ["echidna", "technology", "Echidna ORM"],
    ]
    for (const [q, kind, title] of cases) {
      const rows = await search(a, q)
      const hit = rows.find((r) => r.kind === kind)
      expect(hit, `${q} → ${kind}`).toBeDefined()
      expect(hit!.title).toBe(title)
      if (kind !== "command") expect(hit!.project_name, q).toBe("Quokka Portal")
    }
    const variable = (await search(a, "NUMBAT_API_URL")).find((r) => r.kind === "variable")!
    expect(variable.parent_id).toBeTruthy()
    // Excerpts mark the match for highlighting.
    const doc = (await search(a, "bilby")).find((r) => r.kind === "document")!
    expect(doc.excerpt).toContain("⟪bilby⟫")
  })

  it("limits results per kind, ignores tiny queries and treats wildcards literally", async () => {
    const rows = await search(a, "ready", 1)
    expect(rows.filter((r) => r.kind === "task")).toHaveLength(1)
    expect(await search(a, "q")).toEqual([])
    expect(await search(a, "%")).toEqual([])
    expect((await search(a, "NUMBAT_API")).some((r) => r.title === "NUMBAT_API_URL")).toBe(true)
    expect((await search(a, "NUMBAT%URL")).some((r) => r.kind === "variable")).toBe(false)
  })

  it("never shows another user's data", async () => {
    const { data } = await b.client.rpc("dashboard_summary")
    expect(data?.[0]).toMatchObject({ inbox: 0, ready: 0, overdue: 0, active_projects: 0 })
    for (const q of ["marsupial", "bilby", "NUMBAT", "wombat", "quokka"]) {
      expect(await search(b, q), q).toEqual([])
    }
    const anon = await anonClient().rpc("global_search", { p_query: "quokka" })
    expect(anon.error).not.toBeNull()
    const anonSummary = await anonClient().rpc("dashboard_summary")
    expect(anonSummary.error).not.toBeNull()
  })
})
