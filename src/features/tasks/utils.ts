import {
  labelColor,
  PRIORITY_META,
  TASK_STATUSES,
  type LabelColor,
  type Priority,
  type TaskStatus,
} from "@/lib/constants/domain"

/** Pure task rules shared by queries, lists, the board and tests (Spec FR-02, FR-06). */

export type TaskLabel = { id: string; name: string; color: LabelColor }

/** `labels:task_label_links(label:task_labels(…))` embeds → sorted labels with known colours. */
export function flattenLabels(
  links: { label: { id: string; name: string; color: string } | null }[],
): TaskLabel[] {
  return links
    .map((l) => l.label)
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .map((l) => ({ ...l, color: labelColor(l.color) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

type TaskLike = {
  status: TaskStatus
  due_at: string | null
  next_action: string | null
  priority: Priority
  updated_at?: string
  title?: string
}

/** Overdue is derived, never stored (Spec FR-02): a due date has passed and the task isn't done. */
export function isOverdue(task: Pick<TaskLike, "status" | "due_at">, now: Date = new Date()) {
  return task.status !== "done" && task.due_at !== null && new Date(task.due_at) < now
}

/** In Progress with no concrete next action: the continuity gap the Spec asks us to surface. */
export function missingNextAction(task: Pick<TaskLike, "status" | "next_action">) {
  return task.status === "in_progress" && !task.next_action?.trim()
}

/** Priority first, then soonest due (undated last), then most recently updated. */
export function compareTasks(a: TaskLike, b: TaskLike) {
  const byPriority = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank
  if (byPriority) return byPriority
  const ad = a.due_at ? Date.parse(a.due_at) : Infinity
  const bd = b.due_at ? Date.parse(b.due_at) : Infinity
  if (ad !== bd) return ad - bd
  return (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
}

/* Views and filters ---------------------------------------------------------- */

export const TASK_VIEWS = ["all", "inbox", "upcoming", "blocked", "completed", "archived"] as const
export type TaskView = (typeof TASK_VIEWS)[number]

export const TASK_VIEW_LABELS: Record<TaskView, string> = {
  all: "All",
  inbox: "Inbox",
  upcoming: "Upcoming",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
}

export const TASK_SORTS = ["priority", "due", "updated", "title"] as const
export type TaskSort = (typeof TASK_SORTS)[number]

export const TASK_FLAGS = ["overdue", "no-next-action"] as const
export type TaskFlag = (typeof TASK_FLAGS)[number]

export type TaskFilters = {
  view: TaskView
  layout: "list" | "board"
  q: string
  projectId: string | null
  repositoryId: string | null
  statuses: TaskStatus[]
  priorities: Priority[]
  labelId: string | null
  flags: TaskFlag[]
  sort: TaskSort
  page: number
}

/** The user's default task view (Spec §6.11; Plan P8.1), kept in profiles.preferences.task_view. */
export type TaskViewDefaults = { layout: "list" | "board"; sort: TaskSort }
export const DEFAULT_TASK_VIEW: TaskViewDefaults = { layout: "list", sort: "priority" }

/** Reads preferences.task_view, ignoring anything unexpected. */
export function parseTaskViewPreference(preferences: unknown): TaskViewDefaults {
  const raw = (preferences as { task_view?: { layout?: unknown; sort?: unknown } } | null)
    ?.task_view
  const layout = raw?.layout === "board" ? "board" : "list"
  const sort = (TASK_SORTS as readonly unknown[]).includes(raw?.sort)
    ? (raw!.sort as TaskSort)
    : DEFAULT_TASK_VIEW.sort
  return { layout, sort }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Parse URL search params into typed filters. Unknown values are dropped rather than trusted.
 * Multi-value params are comma-separated: ?status=ready,in_progress&priority=urgent,high
 */
export function parseTaskFilters(
  sp: Record<string, string | string[] | undefined>,
  defaults: TaskViewDefaults = DEFAULT_TASK_VIEW,
): TaskFilters {
  const one = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v)?.toString() ?? ""
  }
  const many = <T extends string>(k: string, allowed: readonly T[]) =>
    one(k)
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is T => (allowed as readonly string[]).includes(s))

  const view = one("view") as TaskView
  const sort = one("sort") as TaskSort
  const project = one("project")
  const label = one("label")
  const repo = one("repo")
  const page = Number.parseInt(one("page"), 10)

  return {
    view: TASK_VIEWS.includes(view) ? view : "all",
    // An explicit layout or sort wins; otherwise the user's saved default applies.
    layout:
      one("layout") === "board" ? "board" : one("layout") === "list" ? "list" : defaults.layout,
    q: one("q").trim().slice(0, 100),
    projectId: UUID.test(project) ? project : null,
    repositoryId: UUID.test(repo) ? repo : null,
    statuses: many("status", TASK_STATUSES),
    priorities: many("priority", Object.keys(PRIORITY_META) as Priority[]),
    labelId: UUID.test(label) ? label : null,
    flags: many("flags", TASK_FLAGS),
    sort: TASK_SORTS.includes(sort) ? sort : defaults.sort,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

/** Board columns: every status in workflow order. */
export const BOARD_COLUMNS: readonly TaskStatus[] = TASK_STATUSES
