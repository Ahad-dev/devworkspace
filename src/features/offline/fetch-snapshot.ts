import type { SupabaseClient } from "@supabase/supabase-js"

import { OFFLINE_DEPENDENCY_SELECT, OFFLINE_TASK_SELECT } from "@/features/tasks/selects"
import type { Database } from "@/types/database.types"
import {
  completedSince,
  MAX_COMMENTS,
  MAX_TASKS,
  type RawOfflineData,
  type RawOfflineTask,
  type TaskRef,
} from "./snapshot"

const PAGE = 500

/**
 * Reads what the offline copy holds (Plan P9.3), as the signed-in user: RLS limits every row to
 * their own. Tasks that aren't archived and are open or were completed in the last
 * COMPLETED_WINDOW_DAYS, highest priority first, capped at MAX_TASKS. Not server-only, so the
 * integration tests run exactly this. Errors carry the area only, never row data.
 */
export async function fetchOfflineData(
  db: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<RawOfflineData> {
  const since = completedSince(now)
  const tasks: RawOfflineTask[] = []
  let truncated = false
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("tasks")
      .select(OFFLINE_TASK_SELECT)
      .is("archived_at", null)
      .or(`status.neq.done,completed_at.gte."${since}"`)
      .order("priority")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("id")
      .order("created_at", { referencedTable: "comments", ascending: false })
      .limit(MAX_COMMENTS, { referencedTable: "comments" })
      .range(from, from + PAGE - 1)
    if (error) throw new Error("Couldn't read tasks")
    const rows: RawOfflineTask[] = data
    tasks.push(...rows)
    if (tasks.length > MAX_TASKS) {
      truncated = true
      tasks.length = MAX_TASKS
      break
    }
    if (rows.length < PAGE) break
  }

  const ids = new Set(tasks.map((t) => t.id))
  const missingParents = [
    ...new Set(tasks.map((t) => t.parent_task_id).filter((id): id is string => !!id)),
  ].filter((id) => !ids.has(id))

  const [projects, parents, dependencies, profile] = await Promise.all([
    db.from("projects").select("id, name, status").order("name").range(0, 999),
    missingParents.length
      ? db.from("tasks").select("id, title, status").in("id", missingParents.slice(0, 500))
      : Promise.resolve({ data: [] as TaskRef[], error: null }),
    db.from("task_dependencies").select(OFFLINE_DEPENDENCY_SELECT).range(0, 1999),
    db.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ])
  if (projects.error) throw new Error("Couldn't read projects")
  if (parents.error) throw new Error("Couldn't read parent tasks")
  if (dependencies.error) throw new Error("Couldn't read dependencies")
  if (profile.error) throw new Error("Couldn't read the profile")

  return {
    timeZone: profile.data?.timezone ?? "UTC",
    truncated,
    projects: projects.data ?? [],
    tasks,
    parents: parents.data ?? [],
    dependencies: dependencies.data ?? [],
  }
}
