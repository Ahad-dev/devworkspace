"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Columns3, List, ListFilter, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LABEL_COLOR_META,
  PRIORITIES,
  PRIORITY_META,
  TASK_STATUSES,
  TASK_STATUS_META,
  type LabelColor,
} from "@/lib/constants/domain"
import { cn } from "@/lib/utils"
import {
  DEFAULT_TASK_VIEW,
  TASK_VIEWS,
  TASK_VIEW_LABELS,
  parseTaskFilters,
  type TaskView,
  type TaskViewDefaults,
} from "../utils"

const ALL = "all"

type Option = { id: string; name: string }

/**
 * Task filter bar (Spec FR-06, §6.5; Plan P3.7). Everything lives in the URL so views are
 * shareable, server-rendered and survive refresh. Any change resets pagination.
 */
export function TaskFilters({
  counts,
  projects,
  repositories,
  labels,
  defaults = DEFAULT_TASK_VIEW,
}: {
  counts: { inbox: number; blocked: number }
  /** The user's saved layout and sort: the URL only records departures from them. */
  defaults?: TaskViewDefaults
  /** Global views only: hidden when the page is scoped to one project. */
  projects?: Option[]
  /** Project views only. */
  repositories?: Option[]
  labels: (Option & { color: LabelColor })[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filters = parseTaskFilters(Object.fromEntries(params.entries()), defaults)
  const [q, setQ] = React.useState(filters.q)

  const update = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(changes)) {
        if (v && v !== ALL) next.set(k, v)
        else next.delete(k)
      }
      next.delete("page")
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  React.useEffect(() => {
    if (q.trim() === filters.q) return
    const t = setTimeout(() => update({ q: q.trim() || null }), 250)
    return () => clearTimeout(t)
  }, [q, filters.q, update])

  function toggle(key: "status" | "priority" | "flags", list: string[], value: string) {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    update({ [key]: next.length ? next.join(",") : null })
  }

  const statusFilterable = filters.view === "all" || filters.view === "archived"
  const activeCount =
    (filters.q ? 1 : 0) +
    (statusFilterable ? filters.statuses.length : 0) +
    filters.priorities.length +
    filters.flags.length +
    (filters.projectId && projects ? 1 : 0) +
    (filters.repositoryId && repositories ? 1 : 0) +
    (filters.labelId ? 1 : 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Task views" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {TASK_VIEWS.map((v) => (
            <ViewTab
              key={v}
              view={v}
              active={filters.view === v}
              count={v === "inbox" ? counts.inbox : v === "blocked" ? counts.blocked : undefined}
              onSelect={() => update({ view: v === "all" ? null : v, status: null })}
            />
          ))}
        </nav>
        <div className="flex items-center gap-1 self-start rounded-lg border p-0.5" role="group">
          <Button
            variant={filters.layout === "list" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={filters.layout === "list"}
            onClick={() => update({ layout: defaults.layout === "list" ? null : "list" })}
          >
            <List />
            List
          </Button>
          <Button
            variant={filters.layout === "board" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={filters.layout === "board"}
            onClick={() => update({ layout: defaults.layout === "board" ? null : "board" })}
          >
            <Columns3 />
            Board
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <div className="relative md:w-60">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="h-8 pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusFilterable ? (
            <MultiSelect
              label="Status"
              selected={filters.statuses}
              options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))}
              onToggle={(v) => toggle("status", filters.statuses, v)}
            />
          ) : null}
          <MultiSelect
            label="Priority"
            selected={filters.priorities}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
            onToggle={(v) => toggle("priority", filters.priorities, v)}
          />

          {projects ? (
            <Select value={filters.projectId ?? ALL} onValueChange={(v) => update({ project: v })}>
              <SelectTrigger size="sm" aria-label="Filter by project" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {repositories && repositories.length > 0 ? (
            <Select value={filters.repositoryId ?? ALL} onValueChange={(v) => update({ repo: v })}>
              <SelectTrigger size="sm" aria-label="Filter by repository" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All repositories</SelectItem>
                {repositories.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {labels.length > 0 ? (
            <Select value={filters.labelId ?? ALL} onValueChange={(v) => update({ label: v })}>
              <SelectTrigger size="sm" aria-label="Filter by label" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All labels</SelectItem>
                {labels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <span
                      className={cn("size-2 rounded-full", LABEL_COLOR_META[l.color].dot)}
                      aria-hidden
                    />
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <MultiSelect
            label="Attention"
            selected={filters.flags}
            options={[
              { value: "overdue", label: "Overdue" },
              { value: "no-next-action", label: "In progress, no next action" },
            ]}
            onToggle={(v) => toggle("flags", filters.flags, v)}
          />

          {filters.view !== "completed" && filters.view !== "upcoming" ? (
            <Select
              value={filters.sort}
              onValueChange={(v) => update({ sort: v === defaults.sort ? null : v })}
            >
              <SelectTrigger size="sm" aria-label="Sort tasks" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="due">Due date</SelectItem>
                <SelectItem value="updated">Recently updated</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
          ) : null}

          {activeCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("")
                const next = new URLSearchParams()
                if (filters.view !== "all") next.set("view", filters.view)
                if (filters.layout !== defaults.layout) next.set("layout", filters.layout)
                const qs = next.toString()
                router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
              }}
            >
              <X />
              Clear all ({activeCount})
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ViewTab({
  view,
  active,
  count,
  onSelect,
}: {
  view: TaskView
  active: boolean
  count?: number
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {TASK_VIEW_LABELS[view]}
      {count ? (
        <span className="rounded-sm bg-background/80 px-1 text-xs tabular-nums ring-1 ring-border">
          {count}
        </span>
      ) : null}
    </button>
  )
}

function MultiSelect({
  label,
  selected,
  options,
  onToggle,
}: {
  label: string
  selected: string[]
  options: { value: string; label: string }[]
  onToggle: (value: string) => void
}) {
  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? `${label}: ${options.find((o) => o.value === selected[0])?.label ?? ""}`
        : `${label}: ${selected.length}`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(selected.length > 0 && "border-primary/40 bg-primary/5")}
        >
          <ListFilter />
          {summary}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            // Keep the menu open so several values can be picked in one go.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onToggle(o.value)}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
