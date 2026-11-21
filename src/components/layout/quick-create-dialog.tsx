"use client"

import * as React from "react"
import {
  BookOpen,
  FolderPlus,
  ListPlus,
  Loader2,
  Server,
  Timer,
  type LucideIcon,
} from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { QuickEnvironmentDialog } from "@/features/environments/components/quick-environment-dialog"
import { CreateDocumentDialog } from "@/features/knowledge/components/create-document-dialog"
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog"
import { loadStartableTasks } from "@/features/sessions/actions"
import { StartSessionDialog } from "@/features/sessions/components/start-session-dialog"
import { loadProjectOptions } from "@/features/tasks/actions"
import { QuickTaskDialog } from "@/features/tasks/components/quick-task-dialog"

/** Quick-create (Spec §3.1, FR-02; Plan P7.3): what the header menu and the dashboard offer. */
export const QUICK_CREATE: { kind: QuickKind; label: string; icon: LucideIcon }[] = [
  { kind: "project", label: "Project", icon: FolderPlus },
  { kind: "task", label: "Task", icon: ListPlus },
  { kind: "session", label: "Work session", icon: Timer },
  { kind: "document", label: "Document", icon: BookOpen },
  { kind: "environment", label: "Environment", icon: Server },
]

export type QuickKind = "project" | "task" | "session" | "document" | "environment"

type Option = { id: string; name: string }

function Loading({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex items-center gap-2 sm:max-w-xs">
        <DialogTitle className="sr-only">Loading</DialogTitle>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <span className="text-sm text-muted-foreground">Loading…</span>
      </DialogContent>
    </Dialog>
  )
}

function DocumentQuick({
  projects,
  onClose,
}: {
  projects: Promise<Option[]>
  onClose: () => void
}) {
  const list = React.use(projects)
  return <CreateDocumentDialog projects={list} open onOpenChange={(o) => !o && onClose()} />
}

function EnvironmentQuick({
  projects,
  onClose,
}: {
  projects: Promise<Option[]>
  onClose: () => void
}) {
  const list = React.use(projects)
  return <QuickEnvironmentDialog projects={list} open onOpenChange={(o) => !o && onClose()} />
}

function SessionQuick({
  tasks,
  onClose,
}: {
  tasks: ReturnType<typeof loadStartableTasks>
  onClose: () => void
}) {
  const list = React.use(tasks)
  return <StartSessionDialog tasks={list} open onOpenChange={(o) => !o && onClose()} />
}

export type QuickCreateRequest = {
  kind: QuickKind
  /** Bumped on every open, as the dialog key, so each open starts fresh. */
  n: number
  projects: Promise<Option[]> | null
  tasks: ReturnType<typeof loadStartableTasks> | null
}

/**
 * Call from the click handler: options start loading as the dialog opens (never during render),
 * so pages that show the trigger stay static.
 */
export function quickCreate(
  kind: QuickKind,
  previous: QuickCreateRequest | null,
): QuickCreateRequest {
  return {
    kind,
    n: (previous?.n ?? 0) + 1,
    projects:
      kind === "task" || kind === "document" || kind === "environment"
        ? // Offline: open with no options; saving then says a connection is needed.
          loadProjectOptions().catch(() => [])
        : null,
    tasks: kind === "session" ? loadStartableTasks().catch(() => []) : null,
  }
}

/** The dialog for one quick-create request. Render with key={request.n}. */
export function QuickCreateDialog({
  request: { kind, projects, tasks },
  onClose,
}: {
  request: QuickCreateRequest
  onClose: () => void
}) {
  const close = (open: boolean) => !open && onClose()

  switch (kind) {
    case "project":
      return <CreateProjectDialog open onOpenChange={close} />
    case "task":
      return <QuickTaskDialog projects={projects!} open onOpenChange={close} />
    case "document":
      return (
        <React.Suspense fallback={<Loading onClose={onClose} />}>
          <DocumentQuick projects={projects!} onClose={onClose} />
        </React.Suspense>
      )
    case "environment":
      return (
        <React.Suspense fallback={<Loading onClose={onClose} />}>
          <EnvironmentQuick projects={projects!} onClose={onClose} />
        </React.Suspense>
      )
    case "session":
      return (
        <React.Suspense fallback={<Loading onClose={onClose} />}>
          <SessionQuick tasks={tasks!} onClose={onClose} />
        </React.Suspense>
      )
  }
}
