"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/lib/constants/domain"

const ALL = "all"

/** Search services across projects by name, provider or purpose (Spec FR-09). */
export function ServiceFilters() {
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

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative sm:w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search services, e.g. Redis"
          aria-label="Search services"
          className="h-8 pl-8"
        />
      </div>
      <Select value={params.get("category") ?? ALL} onValueChange={(v) => setParam("category", v)}>
        <SelectTrigger size="sm" aria-label="Filter by category" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {SERVICE_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {SERVICE_CATEGORY_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
