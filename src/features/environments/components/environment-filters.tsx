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
import { ENVIRONMENT_TYPE_META, ENVIRONMENT_TYPES } from "@/lib/constants/domain"

const ALL = "all"

/** URL-driven filters for environment lists (Plan P5.4). */
export function EnvironmentFilters() {
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

  React.useEffect(() => {
    if (q === (params.get("q") ?? "")) return
    const t = setTimeout(() => setParam("q", q.trim() || null), 250)
    return () => clearTimeout(t)
  }, [q, params, setParam])

  const view = params.get("view") ?? "active"
  const hasFilters = Boolean(params.get("q") || params.get("type"))

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <SegmentedControl
        label="Show environments"
        value={view}
        onValueChange={(v) => setParam("view", v === "active" ? null : v)}
        options={[
          { value: "active", label: "Active" },
          { value: "review", label: "Needs review" },
          { value: "archived", label: "Archived" },
        ]}
      />
      <div className="relative md:w-56">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search environments…"
          aria-label="Search environments"
          className="h-8 pl-8"
        />
      </div>
      <div className="flex items-center gap-2">
        <Select value={params.get("type") ?? ALL} onValueChange={(v) => setParam("type", v)}>
          <SelectTrigger size="sm" aria-label="Filter by type" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {ENVIRONMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ENVIRONMENT_TYPE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("")
              const next = new URLSearchParams()
              if (view !== "active") next.set("view", view)
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
