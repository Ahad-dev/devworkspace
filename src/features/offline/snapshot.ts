import type { Priority, ProjectStatus, TaskStatus } from "@/lib/constants/domain"
import { flattenLabels, type TaskLabel } from "@/features/tasks/utils"

/**
 * The offline copy of the owner's tasks (Spec §2.2 "PWA/offline"; Plan P9.3). Pure shaping and
 * checks, so they are unit-tested without a browser. Kept on the device in IndexedDB as one
 * record, replaced whole on every sync, bound to the user who saved it, and dropped after
 * MAX_AGE_DAYS. Tasks only: no secret values exist in DevWorkspace, and no other area is copied.
 */

export const OFFLINE_SCHEMA_VERSION = 1
/** A copy older than this is neither shown nor kept. */
export const MAX_AGE_DAYS = 30
/** Done tasks stay in the copy for this long after completion. */
export const COMPLETED_WINDOW_DAYS = 14
export const MAX_TASKS = 2000
/** The most recent comments per task. */
export const MAX_COMMENTS = 20

const DAY = 86_400_000

export type TaskRef = { id: string; title: string; status: TaskStatus }

export type OfflineComment = { id: string; content: string; created_at: string; updated_at: string }

export type OfflineTask = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  due_at: string | null
  next_action: string | null
  blocker_details: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  project_id: string
  repository_id: string | null
  parent_task_id: string | null
  project: { name: string } | null
  repository: { name: string } | null
  labels: TaskLabel[]
  /** Oldest first, at most MAX_COMMENTS (the most recent ones). */
  comments: OfflineComment[]
  links: { id: string; label: string | null; url: string }[]
}

export type OfflineSnapshot = {
  version: typeof OFFLINE_SCHEMA_VERSION
  userId: string
  /** ISO time of the sync that produced this copy. */
  syncedAt: string
  timeZone: string
  /** More tasks matched than MAX_TASKS; the lowest-priority ones were left out. */
  truncated: boolean
  projects: { id: string; name: string; status: ProjectStatus }[]
  tasks: OfflineTask[]
  /** Parent tasks that aren't in the copy themselves (done earlier, or archived). */
  refs: TaskRef[]
  /** `task` depends on `dependsOn`; only pairs that touch a task in the copy. */
  dependencies: { task: TaskRef; dependsOn: TaskRef }[]
}

/** Rows as the browser client returns them for OFFLINE_TASK_SELECT. */
export type RawOfflineTask = Omit<OfflineTask, "labels" | "comments"> & {
  labels: { label: { id: string; name: string; color: string } | null }[]
  comments: OfflineComment[]
}

export type RawOfflineData = {
  timeZone: string
  truncated: boolean
  projects: OfflineSnapshot["projects"]
  tasks: RawOfflineTask[]
  parents: TaskRef[]
  dependencies: { task: TaskRef | null; depends_on: TaskRef | null }[]
}

export function buildSnapshot(
  raw: RawOfflineData,
  { userId, now }: { userId: string; now: Date },
): OfflineSnapshot {
  const tasks: OfflineTask[] = raw.tasks.map((t) => ({
    ...t,
    labels: flattenLabels(t.labels),
    comments: [...t.comments]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, MAX_COMMENTS)
      .reverse(),
  }))
  const ids = new Set(tasks.map((t) => t.id))
  const wanted = new Set(
    tasks.map((t) => t.parent_task_id).filter((id): id is string => !!id && !ids.has(id)),
  )

  return {
    version: OFFLINE_SCHEMA_VERSION,
    userId,
    syncedAt: now.toISOString(),
    timeZone: raw.timeZone,
    truncated: raw.truncated,
    projects: [...raw.projects].sort((a, b) => a.name.localeCompare(b.name)),
    tasks,
    refs: raw.parents.filter((p) => wanted.has(p.id)),
    dependencies: raw.dependencies.flatMap((d) =>
      d.task && d.depends_on && (ids.has(d.task.id) || ids.has(d.depends_on.id))
        ? [{ task: d.task, dependsOn: d.depends_on }]
        : [],
    ),
  }
}

/** Whether a stored value is a copy this version can show, and still recent enough to. */
export function isSnapshotUsable(value: unknown, now: Date = new Date()): value is OfflineSnapshot {
  if (!value || typeof value !== "object") return false
  const s = value as Partial<OfflineSnapshot>
  if (s.version !== OFFLINE_SCHEMA_VERSION || typeof s.userId !== "string") return false
  if (!Array.isArray(s.tasks) || !Array.isArray(s.projects)) return false
  const synced = typeof s.syncedAt === "string" ? Date.parse(s.syncedAt) : NaN
  if (Number.isNaN(synced)) return false
  const age = now.getTime() - synced
  // A copy "from the future" means a wrong clock somewhere: don't trust its age.
  return age <= MAX_AGE_DAYS * DAY && age >= -DAY
}

/** The stored value names this user (any version): anything else must be wiped. */
export function belongsTo(value: unknown, userId: string) {
  return !!value && typeof value === "object" && (value as { userId?: unknown }).userId === userId
}

/** Start of the window for done tasks, as an ISO time. */
export function completedSince(now: Date) {
  return new Date(now.getTime() - COMPLETED_WINDOW_DAYS * DAY).toISOString()
}
