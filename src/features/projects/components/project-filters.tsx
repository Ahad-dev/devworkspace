"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  EDITABLE_PROJECT_STATUSES,
  PROJECT_STATUS_META,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
} from "@/lib/constants/domain"

const ALL = "all"

/** Filters live in the URL (shareable, server-rendered, survive refresh). */
export function ProjectFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = React.useState(params.get("q") ?? "")

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value && value !== ALL) next.set(key, value)
      else next.delete(key)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  // Debounce the search box so typing doesn't refetch on every keystroke.
  React.useEffect(() => {
    if (q === (params.get("q") ?? "")) return
    const t = setTimeout(() => setParam("q", q.trim() || null), 250)
    return () => clearTimeout(t)
  }, [q, params, setParam])

  const view = params.get("view") === "archived" ? "archived" : "active"
  const hasFilters = Boolean(params.get("q") || params.get("type") || params.get("status"))

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <SegmentedControl
        label="Show projects"
        value={view}
        onValueChange={(v) => setParam("view", v === "active" ? null : v)}
        options={[
          { value: "active", label: "Active" },
          { value: "archived", label: "Archived" },
        ]}
      />

      <div className="relative md:w-64">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects…"
          aria-label="Search projects"
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={params.get("type") ?? ALL} onValueChange={(v) => setParam("type", v)}>
          <SelectTrigger size="sm" aria-label="Filter by type" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {PROJECT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {PROJECT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {view === "active" ? (
          <Select value={params.get("status") ?? ALL} onValueChange={(v) => setParam("status", v)}>
            <SelectTrigger size="sm" aria-label="Filter by status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {EDITABLE_PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROJECT_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Select
          value={params.get("sort") ?? "updated"}
          onValueChange={(v) => setParam("sort", v === "updated" ? null : v)}
        >
          <SelectTrigger size="sm" aria-label="Sort projects" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("")
              const next = new URLSearchParams()
              if (view === "archived") next.set("view", "archived")
              const qs = next.toString()
              router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
            }}
          >
            <X />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
