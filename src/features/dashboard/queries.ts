import "server-only"

import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { getActiveSession, listSessions } from "@/features/sessions/queries"
import { upcomingUntil } from "./utils"

/**
 * Dashboard reads (Spec FR-02, §6.2; Plan P7.1). Counts come from dashboard_summary() and lists
 * are small, ordered, limited queries: nothing downloads every task into the browser.
 */

export type DashboardSummary = {
  inbox: number
  ready: number
  in_progress: number
  blocked: number
  review: number
  overdue: number
  missing_next_action: number
  environments_needing_review: number
  active_projects: number
}

const EMPTY: DashboardSummary = {
  inbox: 0,
  ready: 0,
  in_progress: 0,
  blocked: 0,
  review: 0,
  overdue: 0,
  missing_next_action: 0,
  environments_needing_review: 0,
  active_projects: 0,
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_summary")
  if (error) throw new Error("Couldn't load the overview")
  return data?.[0] ?? EMPTY
}

const QUEUE_SELECT =
  "id, title, status, priority, due_at, next_action, updated_at, project:projects(id, name)"

/** Ready and In Progress across projects: priority first, then soonest due (Plan P7.1). */
export async function listWorkQueue(limit = 8) {
  await requireUser()
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from("tasks")
    .select(QUEUE_SELECT, { count: "exact" })
    .in("status", ["in_progress", "ready"])
    .is("archived_at", null)
    .order("priority")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("Couldn't load the work queue")
  return { tasks: data ?? [], total: count ?? 0 }
}

export type QueueTask = Awaited<ReturnType<typeof listWorkQueue>>["tasks"][number]

/** Open tasks due from now through the end of the 7th day ahead in the owner's timezone. */
export async function listUpcoming(timeZone: string, now: number, limit = 8) {
  await requireUser()
  const supabase = await createClient()
  const until = upcomingUntil(now, timeZone)
  const { data, error } = await supabase
    .from("tasks")
    .select(QUEUE_SELECT)
    .neq("status", "done")
    .is("archived_at", null)
    .gte("due_at", new Date(now).toISOString())
    .lte("due_at", until)
    .order("due_at")
    .limit(limit)
  if (error) throw new Error("Couldn't load upcoming deadlines")
  return data ?? []
}

/** Active projects with progress = done ÷ non-archived tasks (Plan §9 default 2). */
export async function listProjectOverview(limit = 8) {
  await requireUser()
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from("project_summaries")
    .select(
      "id, name, status, priority, updated_at, task_count, done_task_count, open_task_count",
      {
        count: "exact",
      },
    )
    .in("status", ["active", "maintenance", "on_hold"])
    .order("priority")
    .order("updated_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("Couldn't load projects")
  return { projects: data ?? [], total: count ?? 0 }
}

export async function listRecentActivity(limit = 12) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("activity_events")
    .select(
      "id, event_type, summary, metadata, created_at, project:projects(id, name), task:tasks(id, title)",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("Couldn't load recent activity")
  return data ?? []
}

/** Current focus: the running session, or else the most recently paused one to resume. */
export async function getCurrentFocus() {
  const active = await getActiveSession()
  if (active) return active
  const { sessions } = await listSessions("paused", 1)
  return sessions[0] ?? null
}

export const FEED_PAGE_SIZE = 30

/** Everything that happened across projects, newest first (Plan P7.6). */
export async function listActivityFeed(page = 1) {
  await requireUser()
  const supabase = await createClient()
  const from = (Math.max(1, page) - 1) * FEED_PAGE_SIZE
  const { data, count, error } = await supabase
    .from("activity_events")
    .select(
      "id, event_type, summary, metadata, created_at, project:projects(id, name), task:tasks(id, title)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + FEED_PAGE_SIZE - 1)
  if (error) throw new Error("Couldn't load activity")
  return { events: data ?? [], total: count ?? 0 }
}
