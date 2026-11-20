/**
 * PostgREST select strings for tasks. Composite FKs are named explicitly so embeds are unambiguous.
 * Kept out of the server-only queries module so integration tests can run the exact same selects.
 */

export const TASK_LIST_SELECT =
  "id, title, status, priority, due_at, next_action, blocker_details, updated_at, completed_at, archived_at, project_id, repository_id, parent_task_id, project:projects!tasks_project_owner_fkey(name), repository:repositories!tasks_repository_project_fkey(name), labels:task_label_links(label:task_labels(id, name, color))"

export const TASK_DETAIL_SELECT =
  "*, project:projects!tasks_project_owner_fkey(id, name, status), repository:repositories!tasks_repository_project_fkey(id, name, default_branch)"

export const DEPENDS_ON_SELECT = "task:tasks!task_dependencies_depends_on_fkey(id, title, status)"
export const BLOCKING_SELECT = "task:tasks!task_dependencies_task_fkey(id, title, status)"
export const LABEL_LINK_SELECT = "label:task_labels(id, name, color)"
