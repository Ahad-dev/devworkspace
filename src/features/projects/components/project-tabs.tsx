"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Tasks", segment: "tasks" },
  { label: "Repositories", segment: "repositories" },
  { label: "Environments", segment: "environments" },
  { label: "Services", segment: "services" },
  { label: "Documentation", segment: "documentation" },
  { label: "Activity", segment: "activity" },
] as const

/** Project tabs (Spec FR-03): links, so each tab is a real URL that survives refresh. */
export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const base = `/projects/${projectId}`

  return (
    <nav aria-label="Project sections" className="-mb-px overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b">
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base
          const active = tab.segment
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === base || pathname === `${base}/edit`
          return (
            <li key={tab.label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
