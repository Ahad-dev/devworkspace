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
  COMMAND_CATEGORIES,
  COMMAND_CATEGORY_LABELS,
  DOC_CATEGORIES,
  DOC_CATEGORY_LABELS,
} from "@/lib/constants/domain"

const ALL = "all"

/**
 * URL-driven knowledge filters (Plan P6.4): Documents / Commands, search, category and (on the
 * global page) project, with "Global" for items that belong to no project.
 */
export function KnowledgeFilters({
  projects,
}: {
  /** Omitted inside a project, where the project is fixed. */
  projects?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = React.useState(params.get("q") ?? "")

  const replace = React.useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value && value !== ALL) next.set(key, value)
      else next.delete(key)
      replace(next)
    },
    [params, replace],
  )

  React.useEffect(() => {
    if (q === (params.get("q") ?? "")) return
    const t = setTimeout(() => setParam("q", q.trim() || null), 250)
    return () => clearTimeout(t)
  }, [q, params, setParam])

  const tab = params.get("tab") === "commands" ? "commands" : "documents"
  const view = params.get("view") === "archived" ? "archived" : "active"
  const hasFilters = Boolean(params.get("q") || params.get("category") || params.get("project"))

  function switchTab(next: string) {
    // Categories differ per tab and commands aren't archived: keep only search and project.
    const p = new URLSearchParams()
    if (next === "commands") p.set("tab", "commands")
    const search = params.get("q")
    const project = params.get("project")
    if (search) p.set("q", search)
    if (project) p.set("project", project)
    replace(p)
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <SegmentedControl
        label="Show"
        value={tab}
        onValueChange={switchTab}
        options={[
          { value: "documents", label: "Documents" },
          { value: "commands", label: "Commands" },
        ]}
      />
      <div className="relative lg:w-64">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "commands" ? "Search commands…" : "Search titles and content…"}
          aria-label={tab === "commands" ? "Search commands" : "Search documents"}
          className="h-8 pl-8"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={params.get("category") ?? ALL}
          onValueChange={(v) => setParam("category", v)}
        >
          <SelectTrigger size="sm" aria-label="Filter by category" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {tab === "commands"
              ? COMMAND_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {COMMAND_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))
              : DOC_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {DOC_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
        {projects ? (
          <Select
            value={params.get("project") ?? ALL}
            onValueChange={(v) => setParam("project", v)}
          >
            <SelectTrigger size="sm" aria-label="Filter by project" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              <SelectItem value="global">No project (global)</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {tab === "documents" ? (
          <Select value={view} onValueChange={(v) => setParam("view", v === "active" ? null : v)}>
            <SelectTrigger size="sm" aria-label="Show active or archived" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("")
              const next = new URLSearchParams()
              if (tab === "commands") next.set("tab", "commands")
              if (view === "archived" && tab === "documents") next.set("view", "archived")
              replace(next)
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
