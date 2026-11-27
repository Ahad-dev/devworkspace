import "server-only"

import { cache } from "react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireUser } from "@/lib/auth/session"
import { labelColor } from "@/lib/constants/domain"
import { createClient } from "@/lib/supabase/server"
import {
  BLOCKING_SELECT,
  DEPENDS_ON_SELECT,
  LABEL_LINK_SELECT,
  TASK_DETAIL_SELECT,
  TASK_LIST_SELECT,
} from "./selects"
import {
  BOARD_DONE_DAYS,
  compareTasks,
  flattenLabels,
  isOverdue,
  missingNextAction,
  type TaskFilters,
  type TaskLabel,
} from "./utils"

/**
 * Task reads for Server Components (Spec FR-06, §6.5–6.7; Plan P3.6). Every query runs as the
 * signed-in user, so RLS limits results to their own rows.
 */

export const TASK_PAGE_SIZE = 50
/** The board shows every column at once, so it loads one larger page instead of paginating. */
export const BOARD_LIMIT = 300

const isUuid = (v: string) => z.uuid().safeParse(v).success

export type { TaskLabel }

/* Lists --------------------------------------------------------------------- */

export async function listTasks(filters: TaskFilters, scope: { projectId?: string } = {}) {
  await requireUser()
  const supabase = await createClient()
  const board = filters.layout === "board"

  // Label filter: resolve matching task ids first (RLS-scoped), then filter by id.
  let labelled: string[] | null = null
  if (filters.labelId) {
    const { data } = await supabase
      .from("task_label_links")
      .select("task_id")
      .eq("label_id", filters.labelId)
      .limit(1000)
    labelled = (data ?? []).map((r) => r.task_id)
    if (labelled.length === 0) return { tasks: [], total: 0, page: 1, pageSize: TASK_PAGE_SIZE }
  }

  let q = supabase.from("tasks").select(TASK_LIST_SELECT, { count: "exact" })

  const projectId = scope.projectId ?? filters.projectId
  if (projectId) q = q.eq("project_id", projectId)
  if (filters.repositoryId) q = q.eq("repository_id", filters.repositoryId)
  if (labelled) q = q.in("id", labelled)

  q = filters.view === "archived" ? q.not("archived_at", "is", null) : q.is("archived_at", null)

  switch (filters.view) {
    case "inbox":
      q = q.eq("status", "inbox")
      break
    case "blocked":
      q = q.eq("status", "blocked")
      break
    case "completed":
      q = q.eq("status", "done")
      break
    case "upcoming":
      q = q.not("due_at", "is", null).neq("status", "done")
      break
    default:
      // "All" is the open queue: Done has its own view, except on the board's Done column.
      if (filters.statuses.length) q = q.in("status", filters.statuses)
      else if (!board && filters.view === "all") q = q.neq("status", "done")
      else if (board && filters.view === "all") {
        // The board's Done column keeps recent work only, so old Done tasks can't crowd open
        // ones out of the one-page board (Plan P10.1). The timestamp is quoted for or().
        const since = new Date(Date.now() - BOARD_DONE_DAYS * 86_400_000).toISOString()
        q = q.or(`status.neq.done,completed_at.gte."${since}"`)
      }
  }

  if (filters.priorities.length) q = q.in("priority", filters.priorities)
  if (filters.q) {
    const term = filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)
    q = q.ilike("title", `%${term}%`)
  }
  if (filters.flags.includes("overdue")) {
    q = q.lt("due_at", new Date().toISOString()).neq("status", "done")
  }
  if (filters.flags.includes("no-next-action")) {
    q = q.eq("status", "in_progress").is("next_action", null)
  }

  // Priority sorts by the enum's declared order (urgent → low).
  if (filters.view === "completed") {
    q = q.order("completed_at", { ascending: false })
  } else if (filters.view === "upcoming" || filters.sort === "due") {
    q = q.order("due_at", { ascending: true, nullsFirst: false }).order("priority")
  } else if (filters.sort === "updated") {
    q = q.order("updated_at", { ascending: false })
  } else if (filters.sort === "title") {
    q = q.order("title")
  } else {
    q = q
      .order("priority")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
  }
  q = q.order("id")

  const page = board ? 1 : filters.page
  const size = board ? BOARD_LIMIT : TASK_PAGE_SIZE
  const from = (page - 1) * size
  const { data, error, count } = await q.range(from, from + size - 1)
  if (error) throw new Error("Couldn't load tasks")

  const now = new Date()
  const tasks = (data ?? []).map((t) => ({
    ...t,
    labels: flattenLabels(t.labels),
    // Derived on the server so client components render the same thing as the HTML.
    overdue: isOverdue(t, now),
    missingNextAction: missingNextAction(t),
  }))
  return { tasks, total: count ?? 0, page, pageSize: size }
}

export type TaskListRow = Awaited<ReturnType<typeof listTasks>>["tasks"][number]

/** Open Inbox and Blocked counts for the view tabs. */
export async function getTaskViewCounts(scope: { projectId?: string } = {}) {
  await requireUser()
  const supabase = await createClient()
  const count = async (status: "inbox" | "blocked") => {
    let q = supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", status)
      .is("archived_at", null)
    if (scope.projectId) q = q.eq("project_id", scope.projectId)
    const { count: n } = await q
    return n ?? 0
  }
  const [inbox, blocked] = await Promise.all([count("inbox"), count("blocked")])
  return { inbox, blocked }
}

/* Options for pickers -------------------------------------------------------- */

/** Per request: My Work asks for it in the filters, the board's quick add and the header. */
export const listProjectOptions = cache(async () => {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .neq("status", "archived")
    .order("name")
  if (error) throw new Error("Couldn't load projects")
  return data ?? []
})

export async function listLabels(): Promise<TaskLabel[]> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from("task_labels").select("id, name, color").order("name")
  if (error) throw new Error("Couldn't load labels")
  return (data ?? []).map((l) => ({ ...l, color: labelColor(l.color) }))
}

export async function listRepositoryOptions(projectId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("repositories")
    .select("id, name")
    .eq("project_id", projectId)
    .order("name")
  return data ?? []
}

/** Same-project tasks a task may link to as parent or dependency. */
export async function listTaskOptions(projectId: string, excludeId?: string) {
  await requireUser()
  const supabase = await createClient()
  let q = supabase
    .from("tasks")
    .select("id, title, status")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("title")
    .limit(500)
  if (excludeId) q = q.neq("id", excludeId)
  const { data } = await q
  return data ?? []
}

/* One task ------------------------------------------------------------------- */

export const getTask = cache(async (taskId: string) => {
  await requireUser()
  if (!isUuid(taskId)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_DETAIL_SELECT)
    .eq("id", taskId)
    .maybeSingle()
  if (error) throw new Error("Couldn't load the task")
  if (!data || !data.project) notFound()
  return { ...data, project: data.project }
})

export type TaskDetail = Awaited<ReturnType<typeof getTask>>

export async function getTaskRelations(task: { id: string; parent_task_id: string | null }) {
  await requireUser()
  const supabase = await createClient()
  const [parent, subtasks, dependsOn, blocking, comments, labels, links, activity] =
    await Promise.all([
      task.parent_task_id
        ? supabase
            .from("tasks")
            .select("id, title, status")
            .eq("id", task.parent_task_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("tasks")
        .select("id, title, status, priority, archived_at")
        .eq("parent_task_id", task.id)
        .order("created_at"),
      supabase.from("task_dependencies").select(DEPENDS_ON_SELECT).eq("task_id", task.id),
      supabase.from("task_dependencies").select(BLOCKING_SELECT).eq("depends_on_task_id", task.id),
      supabase
        .from("task_comments")
        .select("id, content, created_at, updated_at")
        .eq("task_id", task.id)
        .order("created_at"),
      supabase.from("task_label_links").select(LABEL_LINK_SELECT).eq("task_id", task.id),
      supabase
        .from("task_links")
        .select("id, label, url")
        .eq("task_id", task.id)
        .order("created_at"),
      supabase
        .from("activity_events")
        .select("id, event_type, summary, metadata, created_at")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ])

  const tasksOf = <T>(rows: { task: T | null }[] | null) =>
    (rows ?? []).map((r) => r.task).filter((t): t is T => t !== null)

  return {
    parent: parent.data,
    subtasks: subtasks.data ?? [],
    dependsOn: tasksOf(dependsOn.data),
    blocking: tasksOf(blocking.data),
    comments: comments.data ?? [],
    labels: flattenLabels(labels.data ?? []),
    links: links.data ?? [],
    activity: activity.data ?? [],
  }
}

/** A project's next tasks for its Overview (Plan P10.6): in progress first, then ready. */
export async function listNextUp(projectId: string, limit = 5) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_LIST_SELECT)
    .eq("project_id", projectId)
    .is("archived_at", null)
    .in("status", ["in_progress", "ready"])
    .order("priority")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(50)
  if (error) throw new Error("Couldn't load tasks")
  const now = new Date()
  return (data ?? [])
    .map((t) => ({
      ...t,
      labels: flattenLabels(t.labels),
      overdue: isOverdue(t, now),
      missingNextAction: missingNextAction(t),
    }))
    .sort((a, b) =>
      a.status === b.status ? compareTasks(a, b) : a.status === "in_progress" ? -1 : 1,
    )
    .slice(0, limit)
}
