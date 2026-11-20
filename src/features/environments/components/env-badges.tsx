import { AlertTriangle, BadgeCheck, FileInput, Hand } from "lucide-react"

import {
  CONFIGURATION_STATUS_META,
  ENVIRONMENT_STATUS_META,
  SERVICE_INSTANCE_STATUS_META,
  VERIFICATION_METHOD_LABELS,
  type ConfigurationStatus,
  type EnvironmentStatus,
  type ServiceInstanceStatus,
  type VerificationMethod,
} from "@/lib/constants/domain"
import { cn } from "@/lib/utils"

const chip =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"

export function EnvironmentStatusBadge({ status }: { status: EnvironmentStatus }) {
  const meta = ENVIRONMENT_STATUS_META[status]
  return <span className={cn(chip, meta.className)}>{meta.label}</span>
}

export function ConfigurationStatusBadge({ status }: { status: ConfigurationStatus }) {
  const meta = CONFIGURATION_STATUS_META[status]
  return <span className={cn(chip, meta.className)}>{meta.label}</span>
}

export function InstanceStatusBadge({ status }: { status: ServiceInstanceStatus }) {
  const meta = SERVICE_INSTANCE_STATUS_META[status]
  return <span className={cn(chip, meta.className)}>{meta.label}</span>
}

/**
 * How a status was established (Spec FR-08 "configuration status honesty"). Manual is plainly a
 * user assertion; only an integration gets the check mark.
 */
export function VerificationBadge({ method }: { method: VerificationMethod }) {
  const Icon = method === "integration" ? BadgeCheck : method === "imported" ? FileInput : Hand
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs whitespace-nowrap",
        method === "integration" ? "font-medium text-status-done" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {VERIFICATION_METHOD_LABELS[method]}
    </span>
  )
}

export function NeedsReviewFlag() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-status-in-progress">
      <AlertTriangle className="size-3.5" aria-hidden />
      Needs review
    </span>
  )
}

/** Spec FR-08 safety UX: unmistakable on every production detail page. */
export function ProductionBanner() {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-env-production/50 bg-env-production/10 px-3 py-2 text-sm"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-env-production" aria-hidden />
      <p>
        <span className="font-semibold text-env-production">Production.</span> Changes here describe
        the live system. Double-check before you edit, and never paste secret values: link a vault
        reference instead.
      </p>
    </div>
  )
}
