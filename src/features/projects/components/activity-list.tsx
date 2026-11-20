import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Boxes,
  CircleCheck,
  FileText,
  Flag,
  FolderPlus,
  GitBranch,
  KeyRound,
  Layers,
  Link2,
  ListPlus,
  MessageSquare,
  NotebookPen,
  Paperclip,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Server,
  ShieldCheck,
  Square,
  SquareTerminal,
  Trash2,
  Unlink,
  Variable,
  type LucideIcon,
} from "lucide-react"

import { formatDateTime, formatRelative } from "@/lib/format"
import type { Database } from "@/types/database.types"

type EventType = Database["public"]["Enums"]["activity_event_type"]

/** Activity registry (Plan §5): human-readable presentation per event type. */
const EVENT_ICON: Record<EventType, LucideIcon> = {
  "project.created": FolderPlus,
  "project.updated": Pencil,
  "project.archived": Archive,
  "project.restored": ArchiveRestore,
  "project.deleted": Trash2,
  "repository.added": GitBranch,
  "repository.updated": GitBranch,
  "repository.removed": GitBranch,
  "technology.added": Layers,
  "technology.removed": Layers,
  "task.created": ListPlus,
  "task.updated": Pencil,
  "task.status_changed": ArrowRightLeft,
  "task.priority_changed": Flag,
  "task.completed": CircleCheck,
  "task.reopened": RotateCcw,
  "task.archived": Archive,
  "task.restored": ArchiveRestore,
  "task.deleted": Trash2,
  "task.comment_added": MessageSquare,
  "task.dependency_added": Link2,
  "task.dependency_removed": Unlink,
  "session.started": Play,
  "session.paused": Pause,
  "session.resumed": Play,
  "session.completed": Square,
  "handoff.saved": NotebookPen,
  "environment.created": Server,
  "environment.updated": Pencil,
  "environment.archived": Archive,
  "environment.restored": ArchiveRestore,
  "environment.reviewed": ShieldCheck,
  "environment.deleted": Trash2,
  "service.added": Boxes,
  "service.updated": Boxes,
  "service.removed": Boxes,
  "service_instance.added": Boxes,
  "service_instance.updated": Boxes,
  "service_instance.removed": Boxes,
  "variable.added": Variable,
  "variable.updated": Variable,
  "variable.removed": Variable,
  "secret_reference.added": KeyRound,
  "secret_reference.removed": KeyRound,
  "document.created": FileText,
  "document.updated": Pencil,
  "document.archived": Archive,
  "document.restored": ArchiveRestore,
  "document.deleted": Trash2,
  "attachment.added": Paperclip,
  "attachment.removed": Paperclip,
  "command.created": SquareTerminal,
  "command.updated": SquareTerminal,
  "command.deleted": Trash2,
}

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  description: "description",
  type: "type",
  status: "status",
  priority: "priority",
  start_date: "start date",
  target_date: "target date",
  project_url: "project URL",
  documentation_url: "docs URL",
  notes: "notes",
  provider: "provider",
  remote_url: "remote URL",
  purpose: "purpose",
  default_branch: "default branch",
  primary_language: "language",
  local_path: "local path",
  readme_url: "README URL",
  title: "title",
  next_action: "next action",
  due_at: "due date",
  repository: "repository",
  parent: "parent task",
  external_reference_url: "reference link",
  machine_label: "machine label",
  application_url: "app URL",
  api_url: "API URL",
  deployment_provider: "deployment provider",
  server_hostname: "hostname",
  operating_system: "OS",
  runtime_versions: "runtimes",
  deployment_branch: "deployment branch",
  deployment_method: "deployment method",
  category: "category",
  dashboard_url: "dashboard URL",
  resource_name: "resource",
  region: "region",
  endpoint_hostname: "endpoint",
  version_or_plan: "version/plan",
  related_variables: "related variables",
  required: "required",
  sensitive: "sensitive",
  verification: "verification",
  secret_reference: "secret reference",
  blocker_details: "blocker details",
  repository_id: "repository",
  parent_task_id: "parent task",
  summary: "summary",
  content: "content",
  project: "project",
  environment: "environment",
  command: "command",
  shell: "shell",
  prerequisites: "prerequisites",
  destructive: "destructive flag",
}

export type ActivityEvent = {
  id: string
  event_type: EventType
  summary: string
  metadata: unknown
  created_at: string
}

function changedFields(metadata: unknown) {
  const changed = (metadata as { changed?: unknown } | null)?.changed
  if (!Array.isArray(changed) || changed.length === 0) return null
  return changed.map((f) => FIELD_LABELS[String(f)] ?? String(f)).join(", ")
}

export function ActivityList({ events, timeZone }: { events: ActivityEvent[]; timeZone: string }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>
  }
  return (
    <ol className="flex flex-col">
      {events.map((e) => {
        const Icon = EVENT_ICON[e.event_type] ?? Pencil
        const fields = changedFields(e.metadata)
        return (
          <li key={e.id} className="flex gap-3 border-b py-2.5 last:border-b-0">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p className="min-w-0 text-sm">
                {e.summary}
                {fields ? <span className="text-muted-foreground"> · {fields}</span> : null}
              </p>
              <time
                dateTime={e.created_at}
                title={formatDateTime(e.created_at, timeZone) ?? undefined}
                className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
              >
                {formatRelative(e.created_at)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
