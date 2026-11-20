"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { TaskStatusBadge } from "@/components/shared/domain-badges"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TaskStatus } from "@/lib/constants/domain"
import { linkDocumentTask, unlinkDocumentTask } from "../actions"

type LinkedTask = {
  id: string
  title: string
  status: TaskStatus
  archived_at: string | null
  project: { id: string; name: string } | null
}
type TaskOption = {
  id: string
  title: string
  status: TaskStatus
  project: { name: string } | null
}

/** Tasks this document supports (Spec FR-10 "link documents to tasks"). */
export function LinkedTasksPanel({
  documentId,
  tasks,
  options,
  showProject,
  readOnly,
}: {
  documentId: string
  tasks: LinkedTask[]
  options: TaskOption[]
  showProject: boolean
  readOnly?: boolean
}) {
  const [choice, setChoice] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const available = options.filter((o) => !tasks.some((t) => t.id === o.id))

  function link() {
    if (!choice) return
    startTransition(async () => {
      const r = await linkDocumentTask(documentId, choice)
      if (r.ok) setChoice("")
      else toast.error(r.error)
    })
  }

  function unlink(taskId: string) {
    startTransition(async () => {
      const r = await unlinkDocumentTask(documentId, taskId)
      if (!r.ok) toast.error(r.error)
    })
  }

  return (
    <section aria-labelledby="linked-tasks-heading" className="flex flex-col gap-2">
      <h2 id="linked-tasks-heading" className="text-sm font-semibold">
        Linked tasks
      </h2>
      {tasks.length ? (
        <ul className="divide-y rounded-md border">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
              <TaskStatusBadge status={t.status} />
              <Link
                href={`/tasks/${t.id}`}
                className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
              >
                {t.title}
                {showProject && t.project ? (
                  <span className="text-muted-foreground"> · {t.project.name}</span>
                ) : null}
              </Link>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Unlink ${t.title}`}
                  disabled={pending}
                  onClick={() => unlink(t.id)}
                >
                  <X />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No linked tasks.</p>
      )}
      {!readOnly ? (
        available.length ? (
          <div className="flex gap-2">
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label="Task to link">
                <SelectValue placeholder="Link a task…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.title}
                    {showProject && o.project ? ` · ${o.project.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!choice || pending}
              onClick={link}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus />}
              Link
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No other tasks to link.</p>
        )
      ) : null}
    </section>
  )
}
