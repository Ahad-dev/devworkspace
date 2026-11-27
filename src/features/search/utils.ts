import {
  COMMAND_SHELL_LABELS,
  DOC_CATEGORY_LABELS,
  ENVIRONMENT_TYPE_META,
  PROJECT_STATUS_META,
  REPOSITORY_PROVIDER_LABELS,
  SERVICE_CATEGORY_LABELS,
  TASK_STATUS_META,
  TECHNOLOGY_CATEGORY_LABELS,
} from "@/lib/constants/domain"

/**
 * Global search presentation (Spec FR-12; Plan P7.4–P7.5): result order, labels, links and
 * highlights. Pure, so the palette, the /search page and the tests share it.
 */

/** Display order: the things people open most first. */
export const SEARCH_KINDS = [
  "project",
  "task",
  "document",
  "command",
  "environment",
  "variable",
  "service",
  "account",
  "repository",
  "technology",
] as const
export type SearchKind = (typeof SEARCH_KINDS)[number]

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  project: "Projects",
  task: "Tasks",
  document: "Documents",
  command: "Commands",
  environment: "Environments",
  variable: "Environment variables",
  service: "Services",
  account: "Accounts",
  repository: "Repositories",
  technology: "Technologies",
}

export type SearchRow = {
  kind: string
  id: string
  title: string
  excerpt: string | null
  meta: string | null
  project_id: string | null
  project_name: string | null
  parent_id: string | null
}

export type SearchResult = {
  kind: SearchKind
  id: string
  title: string
  excerpt: string | null
  meta: string | null
  projectName: string | null
  href: string
}

const lookup = (map: Record<string, unknown>, key: string): string | null => {
  const v = map[key]
  if (typeof v === "string") return v
  if (v && typeof v === "object" && "label" in v) return String((v as { label: string }).label)
  return null
}

/** A short, human label for the row's status, type or category. */
export function metaLabel(kind: SearchKind, meta: string | null): string | null {
  if (!meta) return null
  if (meta === "archived") return "Archived"
  switch (kind) {
    case "project":
      return lookup(PROJECT_STATUS_META, meta)
    case "task":
      return lookup(TASK_STATUS_META, meta)
    case "document":
      return lookup(DOC_CATEGORY_LABELS, meta)
    case "command":
      return lookup(COMMAND_SHELL_LABELS, meta)
    case "environment":
      return lookup(ENVIRONMENT_TYPE_META, meta)
    case "variable":
      // The excerpt already names the environment and the status.
      return null
    case "service":
      return lookup(SERVICE_CATEGORY_LABELS, meta)
    case "account":
      // The excerpt shows the login; never anything from the vault.
      return null
    case "repository":
      return lookup(REPOSITORY_PROVIDER_LABELS, meta)
    case "technology":
      return lookup(TECHNOLOGY_CATEGORY_LABELS, meta)
  }
}

/** Where a result opens: its own page, or the project tab that holds it. */
export function resultHref(row: SearchRow & { kind: SearchKind }): string {
  const project = row.project_id
  switch (row.kind) {
    case "project":
      return `/projects/${row.id}`
    case "task":
      return `/tasks/${row.id}`
    case "document":
      return `/knowledge/documents/${row.id}`
    case "command":
      return project
        ? `/projects/${project}/documentation?tab=commands&q=${encodeURIComponent(row.title)}`
        : `/knowledge?tab=commands&q=${encodeURIComponent(row.title)}`
    case "environment":
      return `/environments/${row.id}`
    case "variable":
      return row.parent_id ? `/environments/${row.parent_id}` : `/projects/${project}/environments`
    case "service":
      return `/projects/${project}/services`
    case "account":
      return `/accounts/${row.id}`
    case "repository":
      return `/projects/${project}/repositories`
    case "technology":
      return `/projects/${project}`
  }
}

const isKind = (k: string): k is SearchKind => (SEARCH_KINDS as readonly string[]).includes(k)

export function toResults(rows: SearchRow[]): SearchResult[] {
  return rows.flatMap((r) =>
    isKind(r.kind)
      ? [
          {
            kind: r.kind,
            id: r.id,
            title: r.title,
            excerpt: r.excerpt?.replace(/\s+/g, " ").trim() || null,
            meta: r.meta,
            projectName: r.project_name,
            href: resultHref({ ...r, kind: r.kind }),
          },
        ]
      : [],
  )
}

/** Results grouped in display order, empty groups dropped. */
export function groupResults(results: SearchResult[]): [SearchKind, SearchResult[]][] {
  return SEARCH_KINDS.flatMap((kind) => {
    const items = results.filter((r) => r.kind === kind)
    return items.length ? [[kind, items] as [SearchKind, SearchResult[]]] : []
  })
}

/** Splits a ts_headline excerpt on its ⟪ ⟫ markers into plain and matched parts. */
export function splitHighlights(excerpt: string): { text: string; match: boolean }[] {
  const parts: { text: string; match: boolean }[] = []
  const re = /⟪([^⟫]*)⟫/g
  let last = 0
  for (const m of excerpt.matchAll(re)) {
    if (m.index > last) parts.push({ text: excerpt.slice(last, m.index), match: false })
    if (m[1]) parts.push({ text: m[1], match: true })
    last = m.index + m[0].length
  }
  if (last < excerpt.length) parts.push({ text: excerpt.slice(last), match: false })
  // Stray markers (e.g. a cut-off fragment) never reach the screen.
  return parts.map((p) => ({ ...p, text: p.text.replace(/[⟪⟫]/g, "") })).filter((p) => p.text)
}
