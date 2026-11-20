import Link from "next/link"
import { FileText, Paperclip, SearchX } from "lucide-react"

import { EnvironmentBadge } from "@/components/shared/domain-badges"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EnvironmentType } from "@/lib/constants/domain"
import { formatRelative } from "@/lib/format"
import type { DocumentListRow, KnowledgeFilters } from "../queries"
import { DocCategoryBadge } from "./knowledge-badges"

/** Documents list (Plan P6.4): the global knowledge base or one project's Documentation tab. */
export function DocumentsTable({
  rows,
  filters,
  showProject,
  renderedAt,
  emptyAction,
}: {
  rows: DocumentListRow[]
  filters: KnowledgeFilters
  showProject: boolean
  renderedAt: number
  emptyAction?: React.ReactNode
}) {
  if (rows.length === 0) {
    const filtered = Boolean(filters.q || filters.docCategory || (showProject && filters.project))
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">{filtered ? <SearchX /> : <FileText />}</EmptyMedia>
          <EmptyTitle>
            {filtered
              ? "No documents match"
              : filters.view === "archived"
                ? "No archived documents"
                : "No documents yet"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Try a different search, category or project."
              : "Write setup guides, runbooks, decision records and troubleshooting notes in Markdown, next to the project they belong to."}
          </EmptyDescription>
        </EmptyHeader>
        {!filtered && filters.view === "active" && emptyAction ? (
          <EmptyContent>{emptyAction}</EmptyContent>
        ) : null}
      </Empty>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-56">Document</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            {showProject ? <TableHead className="hidden sm:table-cell">Project</TableHead> : null}
            <TableHead className="hidden lg:table-cell">Linked to</TableHead>
            <TableHead className="text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="max-w-0 py-2.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/knowledge/documents/${d.id}`}
                    className="flex min-w-0 items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{d.title}</span>
                    {d.attachmentCount ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 text-xs font-normal text-muted-foreground"
                        title={`${d.attachmentCount} attachment${d.attachmentCount === 1 ? "" : "s"}`}
                      >
                        <Paperclip className="size-3" aria-hidden />
                        {d.attachmentCount}
                        <span className="sr-only">
                          {" "}
                          attachment{d.attachmentCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    ) : null}
                  </Link>
                  {d.summary ? (
                    <span className="truncate text-xs text-muted-foreground">{d.summary}</span>
                  ) : null}
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground md:hidden">
                    <DocCategoryBadge category={d.category} />
                    {showProject ? <span>{d.project?.name ?? "Global"}</span> : null}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <DocCategoryBadge category={d.category} />
              </TableCell>
              {showProject ? (
                <TableCell className="hidden text-sm sm:table-cell">
                  {d.project ? (
                    <Link
                      href={`/projects/${d.project.id}/documentation`}
                      className="underline-offset-4 hover:underline"
                    >
                      {d.project.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Global</span>
                  )}
                </TableCell>
              ) : null}
              <TableCell className="hidden text-sm lg:table-cell">
                <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  {d.environment ? (
                    <span className="inline-flex items-center gap-1">
                      <EnvironmentBadge
                        type={d.environment.environment_type as EnvironmentType}
                        variant="short"
                      />
                      {d.environment.name}
                    </span>
                  ) : null}
                  {d.repository ? (
                    <span className="font-mono text-xs">{d.repository.name}</span>
                  ) : null}
                  {!d.environment && !d.repository ? "-" : null}
                </span>
              </TableCell>
              <TableCell className="text-right text-sm whitespace-nowrap text-muted-foreground">
                {formatRelative(d.updated_at, new Date(renderedAt))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
