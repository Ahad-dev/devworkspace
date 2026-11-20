import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * Phase 4 (Spec FR-07, §8.5; Plan P4.1–P4.3, P4.8): work sessions, segments and handoffs.
 * State changes only happen through the session RPCs; the database enforces one running session
 * per user, atomic completion and append-only handoffs.
 */
describe("work sessions", () => {
  let a: TestUser
  let b: TestUser
  let project: string

  beforeAll(async () => {
    a = await createTestUser("p4a")
    b = await createTestUser("p4b")
    const p = await a.client
      .from("projects")
      .insert({ name: "Sessions", project_type: "personal" })
      .select("id")
      .single()
    expect(p.error).toBeNull()
    project = p.data!.id
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  // Each test starts with no running session for A.
  beforeEach(async () => {
    const { data } = await a.client.from("work_sessions").select("id").eq("status", "active")
    for (const s of data ?? []) await a.client.rpc("complete_work_session", { p_session_id: s.id })
  })

  async function task(title: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await a.client
      .from("tasks")
      .insert({ project_id: project, title, ...extra })
      .select("id")
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function start(user: TestUser, taskId: string, extra: Record<string, unknown> = {}) {
    return user.client.rpc("start_work_session", { p_task_id: taskId, ...extra })
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  it("starts a session with an open segment and moves the task to In Progress", async () => {
    const t = await task("Start me", { status: "ready" })
    const { data: id, error } = await start(a, t, { p_branch_name: "feat/sessions" })
    expect(error).toBeNull()

    const s = await a.client.from("work_sessions").select("*").eq("id", id!).single()
    expect(s.data).toMatchObject({
      owner_id: a.id,
      project_id: project,
      task_id: t,
      status: "active",
      branch_name: "feat/sessions",
      ended_at: null,
    })
    const segs = await a.client
      .from("work_session_segments")
      .select("segment_ended_at")
      .eq("work_session_id", id!)
    expect(segs.data).toEqual([{ segment_ended_at: null }])
    const tk = await a.client.from("tasks").select("status").eq("id", t).single()
    expect(tk.data?.status).toBe("in_progress")
  })

  it("allows only one running session, even for concurrent starts", async () => {
    const t1 = await task("Race one")
    const t2 = await task("Race two")
    const results = await Promise.all([start(a, t1), start(a, t2)])
    const ok = results.filter((r) => !r.error)
    const failed = results.filter((r) => r.error)
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(failed[0]?.error?.hint).toBe("active_session_exists")
    expect(failed[0]?.error?.details).toBe(ok[0]?.data)

    const active = await a.client.from("work_sessions").select("id").eq("status", "active")
    expect(active.data).toHaveLength(1)

    // Resuming a paused session is refused while another one runs.
    const other = await task("Paused other")
    await a.client.rpc("complete_work_session", { p_session_id: ok[0]!.data! })
    const s2 = (await start(a, other)).data!
    await a.client.rpc("pause_work_session", { p_session_id: s2 })
    const s3 = (await start(a, t1)).data!
    const resume = await a.client.rpc("resume_work_session", { p_session_id: s2 })
    expect(resume.error?.hint).toBe("active_session_exists")
    expect(resume.error?.details).toBe(s3)
  })

  it("records pause/resume as segments and excludes paused time", async () => {
    const t = await task("Segmented")
    const id = (await start(a, t)).data!
    await sleep(1100)
    expect((await a.client.rpc("pause_work_session", { p_session_id: id })).error).toBeNull()

    const paused = await a.client
      .from("work_session_summaries")
      .select("status, closed_seconds, open_segment_started_at, segment_count")
      .eq("id", id)
      .single()
    expect(paused.data).toMatchObject({ status: "paused", open_segment_started_at: null })
    expect(paused.data?.closed_seconds).toBeGreaterThanOrEqual(1)

    // Pausing again or resuming twice is refused.
    expect((await a.client.rpc("pause_work_session", { p_session_id: id })).error?.hint).toBe(
      "session_not_active",
    )
    await sleep(1500) // paused gap
    expect((await a.client.rpc("resume_work_session", { p_session_id: id })).error).toBeNull()
    expect((await a.client.rpc("resume_work_session", { p_session_id: id })).error?.hint).toBe(
      "session_not_paused",
    )
    expect((await a.client.rpc("complete_work_session", { p_session_id: id })).error).toBeNull()

    const segs = await a.client
      .from("work_session_segments")
      .select("segment_started_at, segment_ended_at")
      .eq("work_session_id", id)
      .order("segment_started_at")
    expect(segs.data).toHaveLength(2)
    const worked = segs.data!.reduce(
      (sum, g) => sum + (Date.parse(g.segment_ended_at!) - Date.parse(g.segment_started_at)),
      0,
    )
    const s = await a.client
      .from("work_sessions")
      .select("started_at, ended_at")
      .eq("id", id)
      .single()
    const wall = Date.parse(s.data!.ended_at!) - Date.parse(s.data!.started_at)
    // The 1.5 s pause is not counted.
    expect(wall - worked).toBeGreaterThanOrEqual(1400)
  })

  it("lets a stale session be closed at an earlier time, within bounds", async () => {
    const t = await task("Left running")
    const id = (await start(a, t)).data!
    const seg = await a.client
      .from("work_session_segments")
      .select("segment_started_at")
      .eq("work_session_id", id)
      .single()
    const startedAt = Date.parse(seg.data!.segment_started_at)

    const future = new Date(Date.now() + 3_600_000).toISOString()
    const before = new Date(startedAt - 60_000).toISOString()
    for (const at of [future, before]) {
      const r = await a.client.rpc("pause_work_session", { p_session_id: id, p_ended_at: at })
      expect(r.error?.hint).toBe("invalid_end_time")
    }
    await sleep(500)
    const at = new Date(startedAt + 200).toISOString()
    expect(
      (await a.client.rpc("pause_work_session", { p_session_id: id, p_ended_at: at })).error,
    ).toBeNull()
    const closed = await a.client
      .from("work_session_segments")
      .select("segment_ended_at")
      .eq("work_session_id", id)
      .single()
    expect(Date.parse(closed.data!.segment_ended_at!)).toBe(startedAt + 200)
  })

  it("completes atomically: a bad handoff leaves the session running", async () => {
    const t = await task("Atomic")
    const id = (await start(a, t)).data!
    const bad = await a.client.rpc("complete_work_session", {
      p_session_id: id,
      p_handoff: {
        next_action: "Should not be saved",
        related_links: [{ label: "Leaky", url: "https://user:pw@example.com/x" }],
      },
    })
    expect(bad.error?.code).toBe("23514")

    const s = await a.client.from("work_sessions").select("status, ended_at").eq("id", id).single()
    expect(s.data).toEqual({ status: "active", ended_at: null })
    const open = await a.client
      .from("work_session_segments")
      .select("id")
      .eq("work_session_id", id)
      .is("segment_ended_at", null)
    expect(open.data).toHaveLength(1)
    expect(
      (await a.client.from("work_handoffs").select("id").eq("work_session_id", id)).data,
    ).toEqual([])
    const tk = await a.client.from("tasks").select("next_action").eq("id", t).single()
    expect(tk.data?.next_action).toBeNull()
  })

  it("completes with a handoff, updates the task's next action and keeps history", async () => {
    const t = await task("Handed off")
    const first = (await start(a, t)).data!
    const done = await a.client.rpc("complete_work_session", {
      p_session_id: first,
      p_handoff: {
        completed_summary: "Wrote the session migration",
        remaining_work: "UI",
        next_action: "Build the header timer",
        related_links: [{ label: "PR", url: "https://github.com/acme/app/pull/7" }],
      },
    })
    expect(done.error).toBeNull()
    expect(done.data).toBeTruthy()

    const s = await a.client
      .from("work_sessions")
      .select("status, ended_at")
      .eq("id", first)
      .single()
    expect(s.data?.status).toBe("completed")
    expect(s.data?.ended_at).not.toBeNull()
    expect((await a.client.rpc("complete_work_session", { p_session_id: first })).error?.hint).toBe(
      "session_completed",
    )

    const tk = await a.client.from("tasks").select("next_action").eq("id", t).single()
    expect(tk.data?.next_action).toBe("Build the header timer")

    // A second session and a progress save without touching the task's next action.
    const second = (await start(a, t)).data!
    const saved = await a.client.rpc("save_work_handoff", {
      p_session_id: second,
      p_handoff: { next_action: "Different idea" },
      p_update_task_next_action: false,
    })
    expect(saved.error).toBeNull()
    expect(
      (await a.client.rpc("save_work_handoff", { p_session_id: second, p_handoff: {} })).error
        ?.hint,
    ).toBe("empty_handoff")
    expect((await a.client.from("tasks").select("next_action").eq("id", t).single()).data).toEqual({
      next_action: "Build the header timer",
    })

    const handoffs = await a.client
      .from("work_handoffs")
      .select("next_action, related_links, work_session_id")
      .eq("task_id", t)
      .order("created_at")
    expect(handoffs.data).toEqual([
      {
        next_action: "Build the header timer",
        related_links: [{ label: "PR", url: "https://github.com/acme/app/pull/7" }],
        work_session_id: first,
      },
      { next_action: "Different idea", related_links: [], work_session_id: second },
    ])
  })

  it("keeps handoffs append-only and status out of client hands", async () => {
    const t = await task("Locked")
    const id = (await start(a, t)).data!
    await a.client.rpc("save_work_handoff", { p_session_id: id, p_handoff: { blockers: "None" } })
    const h = await a.client.from("work_handoffs").select("id").eq("work_session_id", id).single()

    expect(
      (await a.client.from("work_handoffs").update({ blockers: "edited" }).eq("id", h.data!.id))
        .error?.code,
    ).toBe("42501")
    expect((await a.client.from("work_handoffs").delete().eq("id", h.data!.id)).error?.code).toBe(
      "42501",
    )
    expect(
      (
        await a.client
          .from("work_handoffs")
          .insert({ work_session_id: id, project_id: project, task_id: t, blockers: "forged" })
      ).error?.code,
    ).toBe("42501")
    expect(
      (await a.client.from("work_sessions").insert({ project_id: project, task_id: t })).error
        ?.code,
    ).toBe("42501")
    expect(
      (await a.client.from("work_sessions").update({ status: "completed" }).eq("id", id)).error
        ?.code,
    ).toBe("42501")
    expect(
      (
        await a.client
          .from("work_session_segments")
          .update({ segment_ended_at: new Date().toISOString() })
          .eq("work_session_id", id)
      ).error?.code,
    ).toBe("42501")

    // Details are editable.
    const notes = await a.client
      .from("work_sessions")
      .update({ notes: "Pairing with the client", branch_name: "fix/redirect" })
      .eq("id", id)
      .select("notes, branch_name")
      .single()
    expect(notes.data).toEqual({ notes: "Pairing with the client", branch_name: "fix/redirect" })
  })

  it("isolates users: B can't see or drive A's sessions", async () => {
    const t = await task("Private work")
    const id = (await start(a, t)).data!
    await a.client.rpc("save_work_handoff", {
      p_session_id: id,
      p_handoff: { current_state: "Half done" },
    })

    expect((await start(b, t)).error?.hint).toBe("task_not_found")
    for (const fn of [
      "pause_work_session",
      "complete_work_session",
      "resume_work_session",
    ] as const) {
      expect((await b.client.rpc(fn, { p_session_id: id })).error?.hint).toBe("session_not_found")
    }
    expect(
      (await b.client.rpc("save_work_handoff", { p_session_id: id, p_handoff: { blockers: "x" } }))
        .error?.hint,
    ).toBe("session_not_found")
    expect((await b.client.from("work_sessions").select("id").eq("id", id)).data).toEqual([])
    expect((await b.client.from("work_session_summaries").select("id").eq("id", id)).data).toEqual(
      [],
    )
    expect(
      (await b.client.from("work_handoffs").select("id").eq("work_session_id", id)).data,
    ).toEqual([])
    expect(
      (await b.client.from("work_session_segments").select("id").eq("work_session_id", id)).data,
    ).toEqual([])
    expect(
      (await b.client.from("work_sessions").update({ notes: "x" }).eq("id", id).select("id")).data,
    ).toEqual([])

    // Anonymous callers can't run the functions at all.
    const anon = await anonClient().rpc("start_work_session", { p_task_id: t })
    expect(anon.error?.code).toBe("42501")
  })

  it("refuses archived tasks and records activity without handoff text", async () => {
    const archived = await task("Archived one")
    await a.client
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", archived)
    expect((await start(a, archived)).error?.hint).toBe("task_archived")

    const t = await task("Logged")
    const id = (await start(a, t)).data!
    await a.client.rpc("pause_work_session", {
      p_session_id: id,
      p_handoff: { technical_notes: "The staging DB password lives in 1Password" },
    })
    await a.client.rpc("resume_work_session", { p_session_id: id })
    await a.client.rpc("complete_work_session", { p_session_id: id })

    const { data } = await a.client
      .from("activity_events")
      .select("event_type, metadata")
      .eq("task_id", t)
      .order("created_at")
    const types = data!.map((e) => e.event_type).filter((e) => !e.startsWith("task."))
    expect(types).toEqual([
      "session.started",
      "session.paused",
      "handoff.saved",
      "session.resumed",
      "session.completed",
    ])
    expect(JSON.stringify(data)).not.toContain("1Password")
  })

  it("cascades: deleting the task removes its sessions, segments and handoffs", async () => {
    const t = await task("Short lived")
    const id = (await start(a, t)).data!
    await a.client.rpc("complete_work_session", {
      p_session_id: id,
      p_handoff: { completed_summary: "Done" },
    })
    expect((await a.client.from("tasks").delete().eq("id", t)).error).toBeNull()
    expect((await a.client.from("work_sessions").select("id").eq("id", id)).data).toEqual([])
    expect(
      (await a.client.from("work_handoffs").select("id").eq("work_session_id", id)).data,
    ).toEqual([])
  })
})
