import {
  ArrowDown,
  ArrowUp,
  ChevronsUp,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleSlash,
  Equal,
  Eye,
  type LucideIcon,
} from "lucide-react"

/**
 * Domain enums and their display metadata (Spec FR-03, FR-06, FR-08).
 * Colour is never the only signal: every value has an icon and a label too.
 * Class strings are written out in full so Tailwind can see them.
 * The DB enums in supabase/migrations must use the same values.
 */

type Meta = {
  label: string
  icon: LucideIcon
  /** text + subtle background + hairline ring, for badges */
  className: string
}

export const TASK_STATUSES = ["inbox", "ready", "in_progress", "blocked", "review", "done"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_META: Record<TaskStatus, Meta & { description: string }> = {
  inbox: {
    label: "Inbox",
    icon: CircleDashed,
    description: "Captured but not triaged",
    className: "text-status-inbox bg-status-inbox/10 ring-status-inbox/25",
  },
  ready: {
    label: "Ready",
    icon: Circle,
    description: "Understood and ready to start",
    className: "text-status-ready bg-status-ready/10 ring-status-ready/25",
  },
  in_progress: {
    label: "In Progress",
    icon: CircleDot,
    description: "Currently being worked on",
    className: "text-status-in-progress bg-status-in-progress/10 ring-status-in-progress/30",
  },
  blocked: {
    label: "Blocked",
    icon: CircleSlash,
    description: "Waiting on a dependency or response",
    className: "text-status-blocked bg-status-blocked/10 ring-status-blocked/25",
  },
  review: {
    label: "Review",
    icon: Eye,
    description: "Done, needs review or verification",
    className: "text-status-review bg-status-review/10 ring-status-review/25",
  },
  done: {
    label: "Done",
    icon: CircleCheck,
    description: "Completed and verified",
    className: "text-status-done bg-status-done/10 ring-status-done/25",
  },
}

export const PRIORITIES = ["urgent", "high", "medium", "low"] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_META: Record<Priority, Meta & { rank: number }> = {
  urgent: {
    label: "Urgent",
    icon: ChevronsUp,
    rank: 0,
    className: "text-priority-urgent bg-priority-urgent/10 ring-priority-urgent/25",
  },
  high: {
    label: "High",
    icon: ArrowUp,
    rank: 1,
    className: "text-priority-high bg-priority-high/10 ring-priority-high/25",
  },
  medium: {
    label: "Medium",
    icon: Equal,
    rank: 2,
    className: "text-priority-medium bg-priority-medium/10 ring-priority-medium/25",
  },
  low: {
    label: "Low",
    icon: ArrowDown,
    rank: 3,
    className: "text-priority-low bg-priority-low/10 ring-priority-low/25",
  },
}

export const ENVIRONMENT_TYPES = [
  "local",
  "development",
  "staging",
  "production",
  "custom",
] as const
export type EnvironmentType = (typeof ENVIRONMENT_TYPES)[number]

export const ENVIRONMENT_TYPE_META: Record<
  EnvironmentType,
  Omit<Meta, "icon"> & { short: string }
> = {
  local: {
    label: "Local",
    short: "LOCAL",
    className: "text-env-local bg-env-local/10 ring-env-local/25",
  },
  development: {
    label: "Development",
    short: "DEV",
    className: "text-env-development bg-env-development/10 ring-env-development/25",
  },
  staging: {
    label: "Staging",
    short: "STG",
    className: "text-env-staging bg-env-staging/10 ring-env-staging/30",
  },
  // Production is deliberately filled, not subtle (Spec FR-08 safety UX).
  production: {
    label: "Production",
    short: "PROD",
    className: "text-white bg-env-production ring-env-production dark:text-black",
  },
  custom: {
    label: "Custom",
    short: "CUSTOM",
    className: "text-env-custom bg-env-custom/10 ring-env-custom/25",
  },
}
