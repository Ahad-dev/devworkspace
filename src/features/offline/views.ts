import { compareTasks } from "@/features/tasks/utils"
import type { OfflineSnapshot, OfflineTask, TaskRef } from "./snapshot"

/**
 * Which part of the offline copy to show for a URL (Plan P9.4). The service worker serves the
 * offline page in place of any page that can't load, so the address bar still holds the page the
 * user asked for: /my-work, a project, or a task. Pure, so it is unit-tested.
 */

export const QUEUE_VIEWS = ["all", "inbox", "upcoming", "blocked", "completed"] as const
export type QueueView = (typeof QUEUE_VIEWS)[number]

export const QUEUE_VIEW_LABELS: Record<QueueView, string> = {
  all: "All open",
  inbox: "Inbox",
  upcoming: "Upcoming",
  blocked: "Blocked",
  completed: "Recently completed",
}

export type OfflineView =
  | { kind: "queue"; view: QueueView }
  | { kind: "project"; projectId: string }
  | { kind: "task"; taskId: string; editing: boolean }
  | { kind: "unavailable"; path: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function resolveOfflineView(href: string): OfflineView {
  let url: URL
  try {
    url = new URL(href, "http://offline.invalid")
  } catch {
    return { kind: "queue", view: "all" }
  }
  const parts = url.pathname.split("/").filter(Boolean)
  const [first, id, sub, extra] = parts

  if (parts.length === 0 || first === "offline" || first === "dashboard") {
    return { kind: "queue", view: "all" }
  }
  if (first === "my-work" && parts.length === 1) {
    const view = url.searchParams.get("view") ?? "all"
    if ((QUEUE_VIEWS as readonly string[]).includes(view)) {
      return { kind: "queue", view: view as QueueView }
    }
    return { kind: "unavailable", path: url.pathname + url.search }
  }
  if (first === "projects" && id && UUID.test(id) && !extra && (!sub || sub === "tasks")) {
    return { kind: "project", projectId: id }
  }
  if (first === "tasks" && id && UUID.test(id) && !extra && (!sub || sub === "edit")) {
    return { kind: "task", taskId: id, editing: sub === "edit" }
  }
  return { kind: "unavailable", path: url.pathname }
}

/** The My work queues, matching the live views' rules and order. */
export function selectQueue(snapshot: OfflineSnapshot, view: QueueView): OfflineTask[] {
  const tasks = snapshot.tasks
  switch (view) {
    case "inbox":
      return tasks.filter((t) => t.status === "inbox").sort(compareTasks)
    case "blocked":
      return tasks.filter((t) => t.status === "blocked").sort(compareTasks)
    case "upcoming":
      return tasks
        .filter((t) => t.due_at && t.status !== "done")
        .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!) || compareTasks(a, b))
    case "completed":
      return tasks
        .filter((t) => t.status === "done")
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    default:
      return tasks.filter((t) => t.status !== "done").sort(compareTasks)
  }
}

export function selectProjectTasks(snapshot: OfflineSnapshot, projectId: string) {
  const mine = snapshot.tasks.filter((t) => t.project_id === projectId)
  return {
    project: snapshot.projects.find((p) => p.id === projectId) ?? null,
    open: mine.filter((t) => t.status !== "done").sort(compareTasks),
    done: mine
      .filter((t) => t.status === "done")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  }
}

export function selectTaskDetail(snapshot: OfflineSnapshot, taskId: string) {
  const task = snapshot.tasks.find((t) => t.id === taskId)
  if (!task) return null
  const ref = (t: OfflineTask): TaskRef => ({ id: t.id, title: t.title, status: t.status })
  const parentTask = task.parent_task_id
    ? snapshot.tasks.find((t) => t.id === task.parent_task_id)
    : undefined
  return {
    task,
    parent: parentTask
      ? ref(parentTask)
      : (snapshot.refs.find((r) => r.id === task.parent_task_id) ?? null),
    subtasks: snapshot.tasks
      .filter((t) => t.parent_task_id === task.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(ref),
    dependsOn: snapshot.dependencies.filter((d) => d.task.id === task.id).map((d) => d.dependsOn),
    blocking: snapshot.dependencies.filter((d) => d.dependsOn.id === task.id).map((d) => d.task),
  }
}

/** Projects that have tasks in the copy, for the offline navigation. */
export function projectsWithTasks(snapshot: OfflineSnapshot) {
  const counts = new Map<string, number>()
  for (const t of snapshot.tasks) {
    if (t.status !== "done") counts.set(t.project_id, (counts.get(t.project_id) ?? 0) + 1)
  }
  return snapshot.projects
    .filter((p) => counts.has(p.id))
    .map((p) => ({ ...p, open: counts.get(p.id) ?? 0 }))
}
