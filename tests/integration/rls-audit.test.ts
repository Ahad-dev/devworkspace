import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  anonClient,
  createTestUser,
  deleteTestUser,
  requireEnv,
  type TestUser,
} from "../support/supabase"

/**
 * Plan P8.2; Spec §13.2, §18 "Cross-user read/write tests pass": a table-driven audit. User A owns
 * a row in every table; user B and an anonymous visitor try to read, change, delete and attach to
 * it. The list of tables comes from the live API schema, so a new table without an audit entry
 * fails this test.
 */

type Untyped = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any
}
const db = (u: TestUser | ReturnType<typeof anonClient>) =>
  ("client" in u ? u.client : u) as unknown as Untyped

type Entry = {
  /** Columns that identify A's row. */
  key: () => Record<string, string>
  /** A change B tries to make. */
  patch: Record<string, unknown>
  /** A row B tries to insert that points at A's data (or claims A as owner). */
  intrude: () => Record<string, unknown>
}

describe("RLS audit: every table, owner allowed and everyone else denied", () => {
  let a: TestUser
  let b: TestUser
  const id: Record<string, string> = {}

  beforeAll(async () => {
    a = await createTestUser("audit-a")
    b = await createTestUser("audit-b")
    const ins = async (table: string, row: Record<string, unknown>) => {
      const { data, error } = await db(a).from(table).insert(row).select("id").single()
      expect(error, `${table}: ${error?.message}`).toBeNull()
      return data.id as string
    }
    id.project = await ins("projects", { name: "Audit project", project_type: "client" })
    id.repo = await ins("repositories", { project_id: id.project, name: "web" })
    id.tech = await ins("project_technologies", {
      project_id: id.project,
      name: "Next.js",
      category: "frontend",
    })
    id.label = await ins("task_labels", { name: "audit", color: "blue" })
    id.task = await ins("tasks", { project_id: id.project, title: "Audit task", status: "ready" })
    id.task2 = await ins("tasks", { project_id: id.project, title: "Second task" })
    id.link = await ins("task_links", {
      task_id: id.task,
      label: "Spec",
      url: "https://example.com",
    })
    const tl = await db(a).from("task_label_links").insert({ task_id: id.task, label_id: id.label })
    expect(tl.error).toBeNull()
    id.comment = await ins("task_comments", { task_id: id.task, content: "A comment" })
    const dep = await db(a)
      .from("task_dependencies")
      .insert({ project_id: id.project, task_id: id.task2, depends_on_task_id: id.task })
    expect(dep.error).toBeNull()

    const started = await a.client.rpc("start_work_session", { p_task_id: id.task })
    expect(started.error).toBeNull()
    id.session = started.data as string
    const handoff = await a.client.rpc("save_work_handoff", {
      p_session_id: id.session,
      p_handoff: { next_action: "Carry on" },
    })
    expect(handoff.error).toBeNull()
    id.handoff = handoff.data as string
    const seg = await db(a)
      .from("work_session_segments")
      .select("id")
      .eq("work_session_id", id.session)
      .limit(1)
      .single()
    id.segment = seg.data.id

    id.env = await ins("environments", {
      project_id: id.project,
      name: "Production",
      environment_type: "production",
    })
    id.service = await ins("project_services", { project_id: id.project, name: "Postgres" })
    id.instance = await ins("service_instances", {
      project_id: id.project,
      project_service_id: id.service,
      environment_id: id.env,
    })
    id.secretRef = await ins("secret_references", {
      provider: "Doppler",
      vault_path_or_item_id: "prd",
    })
    id.variable = await ins("environment_variables", {
      project_id: id.project,
      environment_id: id.env,
      name: "DATABASE_URL",
      secret_reference_id: id.secretRef,
    })
    id.doc = await ins("documents", { project_id: id.project, title: "Runbook" })
    id.attachment = await ins("document_attachments", {
      document_id: id.doc,
      storage_path: `${a.id}/${id.doc}/${randomUUID()}-notes.txt`,
      file_name: "notes.txt",
      mime_type: "text/plain",
      size_bytes: 5,
    })
    const tdl = await db(a)
      .from("task_document_links")
      .insert({ task_id: id.task, document_id: id.doc })
    expect(tdl.error).toBeNull()
    id.command = await ins("command_snippets", {
      project_id: id.project,
      title: "Run",
      command_text: "pnpm dev",
    })
    const ev = await db(a).from("activity_events").select("id").limit(1).single()
    id.event = ev.data.id
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  const byId = (k: string) => () => ({ id: id[k]! })
  const AUDIT: Record<string, Entry> = {
    profiles: {
      key: () => ({ id: a.id }),
      patch: { display_name: "Taken over" },
      intrude: () => ({ id: a.id, display_name: "Me" }),
    },
    activity_events: {
      key: byId("event"),
      patch: { summary: "Forged" },
      intrude: () => ({ owner_id: a.id, event_type: "project.created", summary: "Forged" }),
    },
    projects: {
      key: byId("project"),
      patch: { name: "Taken over" },
      intrude: () => ({ name: "Mine now", project_type: "client", owner_id: a.id }),
    },
    repositories: {
      key: byId("repo"),
      patch: { name: "taken" },
      intrude: () => ({ project_id: id.project, name: "intruder" }),
    },
    project_technologies: {
      key: byId("tech"),
      patch: { name: "Taken" },
      intrude: () => ({ project_id: id.project, name: "Intruder", category: "other" }),
    },
    task_labels: {
      key: byId("label"),
      patch: { name: "taken" },
      intrude: () => ({ name: "intruder", owner_id: a.id }),
    },
    tasks: {
      key: byId("task"),
      patch: { title: "Taken over" },
      intrude: () => ({ project_id: id.project, title: "Intruder" }),
    },
    task_links: {
      key: byId("link"),
      patch: { label: "Taken" },
      intrude: () => ({ task_id: id.task, label: "x", url: "https://example.com/x" }),
    },
    task_label_links: {
      key: () => ({ task_id: id.task!, label_id: id.label! }),
      patch: { label_id: id.label },
      intrude: () => ({ task_id: id.task2, label_id: id.label }),
    },
    task_comments: {
      key: byId("comment"),
      patch: { content: "Taken over" },
      intrude: () => ({ task_id: id.task, content: "Intruder" }),
    },
    task_dependencies: {
      key: () => ({ task_id: id.task2!, depends_on_task_id: id.task! }),
      patch: { project_id: id.project },
      intrude: () => ({ project_id: id.project, task_id: id.task, depends_on_task_id: id.task2 }),
    },
    work_sessions: {
      key: byId("session"),
      patch: { notes: "Taken over" },
      intrude: () => ({ project_id: id.project, task_id: id.task }),
    },
    work_session_segments: {
      key: byId("segment"),
      patch: { ended_at: new Date().toISOString() },
      intrude: () => ({ work_session_id: id.session }),
    },
    work_handoffs: {
      key: byId("handoff"),
      patch: { next_action: "Forged" },
      intrude: () => ({ project_id: id.project, task_id: id.task, work_session_id: id.session }),
    },
    environments: {
      key: byId("env"),
      patch: { name: "Taken" },
      intrude: () => ({ project_id: id.project, name: "Intruder", environment_type: "custom" }),
    },
    project_services: {
      key: byId("service"),
      patch: { name: "Taken" },
      intrude: () => ({ project_id: id.project, name: "Intruder" }),
    },
    service_instances: {
      key: byId("instance"),
      patch: { resource_name: "taken" },
      intrude: () => ({
        project_id: id.project,
        project_service_id: id.service,
        environment_id: id.env,
      }),
    },
    secret_references: {
      key: byId("secretRef"),
      patch: { provider: "Taken" },
      intrude: () => ({ provider: "x", vault_path_or_item_id: "x", owner_id: a.id }),
    },
    environment_variables: {
      key: byId("variable"),
      patch: { name: "TAKEN" },
      intrude: () => ({ project_id: id.project, environment_id: id.env, name: "INTRUDER" }),
    },
    documents: {
      key: byId("doc"),
      patch: { title: "Taken" },
      intrude: () => ({ project_id: id.project, title: "Intruder" }),
    },
    document_attachments: {
      key: byId("attachment"),
      patch: { file_name: "taken.txt" },
      intrude: () => ({
        document_id: id.doc,
        storage_path: `${b.id}/${id.doc}/${randomUUID()}-x.txt`,
        file_name: "x.txt",
        mime_type: "text/plain",
        size_bytes: 1,
      }),
    },
    task_document_links: {
      key: () => ({ task_id: id.task!, document_id: id.doc! }),
      patch: { task_id: id.task2 },
      intrude: () => ({ task_id: id.task2, document_id: id.doc }),
    },
    command_snippets: {
      key: byId("command"),
      patch: { title: "Taken" },
      intrude: () => ({ project_id: id.project, title: "Intruder", command_text: "ls" }),
    },
  }
  const VIEWS: Record<string, () => Record<string, string>> = {
    project_summaries: () => ({ id: id.project! }),
    work_session_summaries: () => ({ id: id.session! }),
  }

  it("covers every table and view the API exposes", async () => {
    const key = requireEnv("SUPABASE_SECRET_KEY")
    const res = await fetch(`${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    expect(res.status).toBe(200)
    const exposed = Object.keys(((await res.json()) as { definitions: object }).definitions).sort()
    expect(exposed).toEqual([...Object.keys(AUDIT), ...Object.keys(VIEWS)].sort())

    // Anonymous callers don't even get the schema.
    const anon = await fetch(`${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/`, {
      headers: { apikey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") },
    })
    expect(anon.status).toBeGreaterThanOrEqual(400)
  })

  it.each(Object.keys(AUDIT))("%s: others can't read, change, delete or attach", async (table) => {
    const entry = AUDIT[table]!
    const key = entry.key()
    const before = await db(a).from(table).select("*").match(key)
    expect(before.error).toBeNull()
    expect(before.data, `${table}: A sees own row`).toHaveLength(1)

    for (const [who, client] of [
      ["B", db(b)],
      ["anon", db(anonClient())],
    ] as const) {
      const read = await client.from(table).select("*").match(key)
      expect(read.data ?? [], `${who} reads ${table}`).toEqual([])

      const upd = await client.from(table).update(entry.patch).match(key).select()
      expect(upd.data ?? [], `${who} updates ${table}`).toEqual([])

      const del = await client.from(table).delete().match(key).select()
      expect(del.data ?? [], `${who} deletes ${table}`).toEqual([])

      const ins = await client.from(table).insert(entry.intrude()).select()
      expect(ins.error, `${who} inserts into ${table}`).not.toBeNull()
    }

    const after = await db(a).from(table).select("*").match(key)
    expect(after.data, `${table}: A's row unchanged`).toEqual(before.data)
  })

  it.each(Object.keys(VIEWS))("%s: others see nothing", async (view) => {
    const key = VIEWS[view]!()
    const own = await db(a).from(view).select("*").match(key)
    expect(own.data).toHaveLength(1)
    for (const client of [db(b), db(anonClient())]) {
      const r = await client.from(view).select("*").match(key)
      expect(r.data ?? []).toEqual([])
    }
  })

  it("others can't run session functions on the owner's work", async () => {
    const start = await b.client.rpc("start_work_session", { p_task_id: id.task! })
    expect(start.error).not.toBeNull()
    const pause = await b.client.rpc("pause_work_session", { p_session_id: id.session! })
    expect(pause.error).not.toBeNull()
    const handoff = await b.client.rpc("save_work_handoff", {
      p_session_id: id.session!,
      p_handoff: { next_action: "Forged" },
    })
    expect(handoff.error).not.toBeNull()
    const anon = await anonClient().rpc("start_work_session", { p_task_id: id.task! })
    expect(anon.error).not.toBeNull()
  })
})
