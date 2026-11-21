/**
 * PostgREST select strings for tasks. Composite FKs are named explicitly so embeds are unambiguous.
 * Kept out of the server-only queries module so integration tests can run the exact same selects.
 */

export const TASK_LIST_SELECT =
  "id, title, status, priority, due_at, next_action, blocker_details, updated_at, completed_at, archived_at, project_id, repository_id, parent_task_id, project:projects!tasks_project_owner_fkey(name), repository:repositories!tasks_repository_project_fkey(name), labels:task_label_links(label:task_labels(id, name, color))"

export const TASK_DETAIL_SELECT =
  "*, project:projects!tasks_project_owner_fkey(id, name, status), repository:repositories!tasks_repository_project_fkey(id, name, default_branch)"

/**
 * The offline copy of a task (Plan P9.3): the list columns plus what the read-only detail shows.
 * Explicit columns, never `*`, so owner_id and search_vector stay out of the browser's storage.
 */
export const OFFLINE_TASK_SELECT =
  "id, title, description, status, priority, due_at, next_action, blocker_details, created_at, updated_at, completed_at, project_id, repository_id, parent_task_id, project:projects!tasks_project_owner_fkey(name), repository:repositories!tasks_repository_project_fkey(name), labels:task_label_links(label:task_labels(id, name, color)), comments:task_comments!task_comments_task_owner_fkey(id, content, created_at, updated_at), links:task_links!task_links_task_owner_fkey(id, label, url)"

/** Both ends of a dependency: `task` depends on `depends_on`. */
export const OFFLINE_DEPENDENCY_SELECT =
  "task:tasks!task_dependencies_task_fkey(id, title, status), depends_on:tasks!task_dependencies_depends_on_fkey(id, title, status)"

export const DEPENDS_ON_SELECT = "task:tasks!task_dependencies_depends_on_fkey(id, title, status)"
export const BLOCKING_SELECT = "task:tasks!task_dependencies_task_fkey(id, title, status)"
export const LABEL_LINK_SELECT = "label:task_labels(id, name, color)"
