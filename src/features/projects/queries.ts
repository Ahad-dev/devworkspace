import "server-only"

import { cache } from "react"
import { notFound } from "next/navigation"
import { z } from "zod"

import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/constants/domain"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Read helpers for Server Components. Every query runs as the signed-in user, so RLS limits
 * results to their own rows; requireUser() keeps anonymous calls out before any query runs.
 */

const isUuid = (v: string) => z.uuid().safeParse(v).success

/* Project list -------------------------------------------------------------- */

export const PROJECT_SORTS = ["updated", "name", "priority"] as const
export type ProjectSort = (typeof PROJECT_SORTS)[number]

export type ProjectListFilters = {
  q: string
  view: "active" | "archived"
  type: ProjectType | null
  status: ProjectStatus | null
  sort: ProjectSort
}

/** Parse ?q=&view=&type=&status=&sort= into safe, typed filters. Unknown values are ignored. */
export function parseProjectFilters(
  sp: Record<string, string | string[] | undefined>,
): ProjectListFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k])?.toString() ?? ""
  const type = one("type")
  const status = one("status")
  const sort = one("sort")
  return {
    q: one("q").trim().slice(0, 100),
    view: one("view") === "archived" ? "archived" : "active",
    type: (PROJECT_TYPES as readonly string[]).includes(type) ? (type as ProjectType) : null,
    status:
      (PROJECT_STATUSES as readonly string[]).includes(status) && status !== "archived"
        ? (status as ProjectStatus)
        : null,
    sort: (PROJECT_SORTS as readonly string[]).includes(sort) ? (sort as ProjectSort) : "updated",
  }
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export async function listProjects(filters: ProjectListFilters) {
  await requireUser()
  const supabase = await createClient()
  let query = supabase
    .from("project_summaries")
    .select(
      "id, name, project_type, status, priority, repository_count, technology_count, task_count, done_task_count, updated_at, archived_at",
    )
    .limit(200)

  query =
    filters.view === "archived" ? query.eq("status", "archived") : query.neq("status", "archived")
  if (filters.type) query = query.eq("project_type", filters.type)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.q) {
    // Escape LIKE wildcards so the search is literal.
    const term = filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)
    query = query.ilike("name", `%${term}%`)
  }
  query =
    filters.sort === "name"
      ? query.order("name", { ascending: true })
      : query.order("updated_at", { ascending: false })

  const { data, error } = await query
  if (error) throw new Error("Couldn't load projects")

  const rows = data ?? []
  if (filters.sort === "priority") {
    rows.sort(
      (x, y) =>
        (PRIORITY_RANK[x.priority ?? ""] ?? 9) - (PRIORITY_RANK[y.priority ?? ""] ?? 9) ||
        (x.name ?? "").localeCompare(y.name ?? ""),
    )
  }
  return rows
}

/* One project -------------------------------------------------------------- */

export const getProject = cache(async (projectId: string) => {
  await requireUser()
  if (!isUuid(projectId)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle()
  if (error) throw new Error("Couldn't load the project")
  if (!data) notFound()
  return data
})

export const getProjectCounts = cache(async (projectId: string) => {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("project_summaries")
    .select("repository_count, technology_count, task_count, done_task_count, open_task_count")
    .eq("id", projectId)
    .maybeSingle()
  return {
    repositories: data?.repository_count ?? 0,
    technologies: data?.technology_count ?? 0,
    tasks: data?.task_count ?? 0,
    doneTasks: data?.done_task_count ?? 0,
    openTasks: data?.open_task_count ?? 0,
  }
})

export async function listRepositories(projectId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("project_id", projectId)
    .order("name", { ascending: true })
  if (error) throw new Error("Couldn't load repositories")
  return data ?? []
}

export async function listTechnologies(projectId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_technologies")
    .select("id, name, category, version, repository_id")
    .eq("project_id", projectId)
    .order("category", { ascending: true })
    .order("name", { ascending: true })
  if (error) throw new Error("Couldn't load technologies")
  return data ?? []
}

export const ACTIVITY_PAGE_SIZE = 25

export async function listProjectActivity(projectId: string, page = 1) {
  await requireUser()
  const supabase = await createClient()
  const from = (Math.max(1, page) - 1) * ACTIVITY_PAGE_SIZE
  const { data, error, count } = await supabase
    .from("activity_events")
    .select("id, event_type, summary, metadata, created_at", { count: "exact" })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(from, from + ACTIVITY_PAGE_SIZE - 1)
  if (error) throw new Error("Couldn't load activity")
  return { events: data ?? [], total: count ?? 0 }
}
