"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PRIORITIES,
  PRIORITY_META,
  TASK_STATUSES,
  TASK_STATUS_META,
  type Priority,
  type TaskStatus,
} from "@/lib/constants/domain"
import { cn } from "@/lib/utils"
import { changeTaskPriority, changeTaskStatus } from "../actions"
import { BlockerDialog } from "./blocker-dialog"
import { offlineResult, whenOnline } from "@/lib/offline/guard"

/**
 * Status picker shown as the status badge. It is the keyboard alternative to dragging on the
 * board (Spec §6.6) and is used in list rows and on the detail page. The new status shows
 * immediately and rolls back with a toast if the server rejects it.
 * When `onChange` is passed (the board), the parent owns the optimistic state.
 */
export function TaskStatusMenu({
  taskId,
  taskTitle,
  status,
  onChange,
  className,
}: {
  taskId: string
  taskTitle: string
  status: TaskStatus
  onChange?: (status: TaskStatus, blockerDetails?: string) => void
  className?: string
}) {
  const [optimistic, setOptimistic] = React.useOptimistic(status)
  const [pending, startTransition] = React.useTransition()
  const [blockerOpen, setBlockerOpen] = React.useState(false)

  function apply(next: TaskStatus, blockerDetails?: string) {
    if (onChange) return onChange(next, blockerDetails)
    startTransition(async () => {
      setOptimistic(next)
      const result = await whenOnline(
        () => changeTaskStatus({ taskId, status: next, blockerDetails }),
        offlineResult,
      )
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            pending && "opacity-70",
            className,
          )}
          aria-label={`Status: ${TASK_STATUS_META[optimistic].label}. Change status of ${taskTitle}`}
          aria-busy={pending}
        >
          <TaskStatusBadge status={optimistic} />
          <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={optimistic}
            onValueChange={(v) => {
              const next = v as TaskStatus
              if (next === optimistic) return
              if (next === "blocked") setBlockerOpen(true)
              else apply(next)
            }}
          >
            {TASK_STATUSES.map((s) => {
              const Icon = TASK_STATUS_META[s].icon
              return (
                <DropdownMenuRadioItem key={s} value={s}>
                  <Icon aria-hidden />
                  {TASK_STATUS_META[s].label}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BlockerDialog
        open={blockerOpen}
        taskTitle={taskTitle}
        onCancel={() => setBlockerOpen(false)}
        onConfirm={(details) => {
          setBlockerOpen(false)
          apply("blocked", details)
        }}
      />
    </>
  )
}

/** Priority picker for the detail page header. */
export function TaskPriorityMenu({ taskId, priority }: { taskId: string; priority: Priority }) {
  const [optimistic, setOptimistic] = React.useOptimistic(priority)
  const [pending, startTransition] = React.useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          pending && "opacity-70",
        )}
        aria-label={`Priority: ${PRIORITY_META[optimistic].label}. Change priority`}
      >
        <PriorityBadge priority={optimistic} />
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuRadioGroup
          value={optimistic}
          onValueChange={(v) => {
            const next = v as Priority
            startTransition(async () => {
              setOptimistic(next)
              const result = await whenOnline(
                () => changeTaskPriority({ taskId, priority: next }),
                offlineResult,
              )
              if (!result.ok) toast.error(result.error)
            })
          }}
        >
          {PRIORITIES.map((p) => {
            const Icon = PRIORITY_META[p].icon
            return (
              <DropdownMenuRadioItem key={p} value={p}>
                <Icon aria-hidden />
                {PRIORITY_META[p].label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
