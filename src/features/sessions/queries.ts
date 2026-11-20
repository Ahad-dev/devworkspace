import "server-only"

import { cache } from "react"

import { requireUser } from "@/lib/auth/session"
import type { TaskStatus } from "@/lib/constants/domain"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database.types"

/**
 * Work-session reads (Spec FR-07, §6.8; Plan P4.4–P4.7). Durations come from the
 * work_session_summaries view (recorded segments), never from a client timer.
 */

type SessionStatus = Database["public"]["Enums"]["session_status"]

const SUMMARY_SELECT =
  "id, project_id, task_id, repository_id, branch_name, notes, status, started_at, ended_at, closed_seconds, open_segment_started_at, last_segment_ended_at, segment_count"

export type SessionView = {
  id: string
  status: SessionStatus
  startedAt: string
  endedAt: string | null
  closedSeconds: number
  openSegmentStartedAt: string | null
  lastSegmentEndedAt: string | null
  segmentCount: number
  branchName: string | null
  notes: string | null
  repositoryId: string | null
  project: { id: string; name: string }
  task: { id: string; title: string; status: TaskStatus; nextAction: string | null } | null
  repository: { id: string; name: string } | null
}

// The columns SUMMARY_SELECT reads (owner_id and updated_at aren't needed).
type SummaryRow = Omit<
  Database["public"]["Views"]["work_session_summaries"]["Row"],
  "owner_id" | "updated_at"
>

/** Attach task, project and repository names in three batched reads. */
async function withContext(rows: SummaryRow[]): Promise<SessionView[]> {
  const valid = rows.filter(
    (r): r is SummaryRow & { id: string; project_id: string; status: SessionStatus } =>
      Boolean(r.id && r.project_id && r.status && r.started_at),
  )
  if (valid.length === 0) return []
  const supabase = await createClient()
  const unique = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))]
  const taskIds = unique(valid.map((r) => r.task_id))
  const repoIds = unique(valid.map((r) => r.repository_id))
  const [tasks, projects, repos] = await Promise.all([
    taskIds.length
      ? supabase.from("tasks").select("id, title, status, next_action").in("id", taskIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("projects")
      .select("id, name")
      .in("id", unique(valid.map((r) => r.project_id))),
    repoIds.length
      ? supabase.from("repositories").select("id, name").in("id", repoIds)
      : Promise.resolve({ data: [] }),
  ])
  const taskMap = new Map((tasks.data ?? []).map((t) => [t.id, t]))
  const projectMap = new Map((projects.data ?? []).map((p) => [p.id, p]))
  const repoMap = new Map((repos.data ?? []).map((r) => [r.id, r]))

  return valid.map((r) => {
    const t = r.task_id ? taskMap.get(r.task_id) : undefined
    return {
      id: r.id,
      status: r.status,
      startedAt: r.started_at!,
      endedAt: r.ended_at,
      closedSeconds: Number(r.closed_seconds ?? 0),
      openSegmentStartedAt: r.open_segment_started_at,
      lastSegmentEndedAt: r.last_segment_ended_at,
      segmentCount: Number(r.segment_count ?? 0),
      branchName: r.branch_name,
      notes: r.notes,
      repositoryId: r.repository_id,
      project: projectMap.get(r.project_id) ?? { id: r.project_id, name: "Project" },
      task: t ? { id: t.id, title: t.title, status: t.status, nextAction: t.next_action } : null,
      repository: r.repository_id ? (repoMap.get(r.repository_id) ?? null) : null,
    }
  })
}

/** The running session, if any (at most one per user: the database guarantees it). */
export const getActiveSession = cache(async (): Promise<SessionView | null> => {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("work_session_summaries")
    .select(SUMMARY_SELECT)
    .eq("status", "active")
    .limit(1)
  const [session] = await withContext(data ?? [])
  return session ?? null
})

export const SESSIONS_PAGE_SIZE = 25

export async function listSessions(status: SessionStatus, page = 1) {
  await requireUser()
  const supabase = await createClient()
  const from = (Math.max(1, page) - 1) * SESSIONS_PAGE_SIZE
  const { data, error, count } = await supabase
    .from("work_session_summaries")
    .select(SUMMARY_SELECT, { count: "exact" })
    .eq("status", status)
    .order(status === "completed" ? "ended_at" : "started_at", { ascending: false })
    .range(from, from + SESSIONS_PAGE_SIZE - 1)
  if (error) throw new Error("Couldn't load sessions")
  return { sessions: await withContext(data ?? []), total: count ?? 0 }
}

export type HandoffView = {
  id: string
  sessionId: string
  createdAt: string
  completedSummary: string | null
  currentState: string | null
  remainingWork: string | null
  nextAction: string | null
  blockers: string | null
  technicalNotes: string | null
  relatedLinks: { label: string; url: string }[]
}

function toLinks(value: unknown): { label: string; url: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (l): l is { label: string; url: string } =>
        typeof l?.label === "string" && typeof l?.url === "string" && /^https?:\/\//.test(l.url),
    )
    .map((l) => ({ label: l.label, url: l.url }))
}

const HANDOFF_SELECT =
  "id, work_session_id, task_id, created_at, completed_summary, current_state, remaining_work, next_action, blockers, technical_notes, related_links"

function toHandoff(h: {
  id: string
  work_session_id: string
  created_at: string
  completed_summary: string | null
  current_state: string | null
  remaining_work: string | null
  next_action: string | null
  blockers: string | null
  technical_notes: string | null
  related_links: unknown
}): HandoffView {
  return {
    id: h.id,
    sessionId: h.work_session_id,
    createdAt: h.created_at,
    completedSummary: h.completed_summary,
    currentState: h.current_state,
    remainingWork: h.remaining_work,
    nextAction: h.next_action,
    blockers: h.blockers,
    technicalNotes: h.technical_notes,
    relatedLinks: toLinks(h.related_links),
  }
}

/** Continuity for one task (Spec §5.5): latest handoff first, then session history. */
export async function getTaskContinuity(taskId: string) {
  await requireUser()
  const supabase = await createClient()
  const [sessions, handoffs] = await Promise.all([
    supabase
      .from("work_session_summaries")
      .select(SUMMARY_SELECT)
      .eq("task_id", taskId)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("work_handoffs")
      .select(HANDOFF_SELECT)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(50),
  ])
  const views = await withContext(sessions.data ?? [])
  return {
    /** This task's running or paused session, if any. */
    current: views.find((s) => s.status !== "completed") ?? null,
    sessions: views,
    handoffs: (handoffs.data ?? []).map(toHandoff),
  }
}

/** Latest handoff in a project, with its task (Spec FR-07: reachable from the project too). */
export async function getLatestProjectHandoff(projectId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("work_handoffs")
    .select(HANDOFF_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("id", data.task_id)
    .maybeSingle()
  return { handoff: toHandoff(data), task }
}
