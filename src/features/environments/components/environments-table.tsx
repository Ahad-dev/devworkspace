import Link from "next/link"
import { SearchX, Server } from "lucide-react"

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
import { formatRelative } from "@/lib/format"
import type { EnvironmentListFilters, EnvironmentListRow } from "../queries"
import { needsReview } from "../utils"
import { EnvironmentStatusBadge, NeedsReviewFlag } from "./env-badges"

/** Environments list (Plan P5.4): global (with project) or one project's tab. */
export function EnvironmentsTable({
  rows,
  filters,
  showProject,
  renderedAt,
  emptyAction,
}: {
  rows: EnvironmentListRow[]
  filters: EnvironmentListFilters
  showProject: boolean
  renderedAt: number
  emptyAction?: React.ReactNode
}) {
  const shown = filters.view === "review" ? rows.filter((r) => needsReview(r, renderedAt)) : rows

  if (shown.length === 0) {
    const filtered = Boolean(filters.q || filters.type)
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">{filtered ? <SearchX /> : <Server />}</EmptyMedia>
          <EmptyTitle>
            {filtered
              ? "No environments match"
              : filters.view === "archived"
                ? "No archived environments"
                : filters.view === "review"
                  ? "Nothing needs review"
                  : "No environments yet"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Try a different search or type."
              : filters.view === "review"
                ? "Environments marked Needs review, or not reviewed for 90 days, show up here."
                : "Document local, development, staging and production: URLs, hosts, services and the variables each one needs."}
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
            <TableHead className="min-w-48">Environment</TableHead>
            {showProject ? <TableHead className="hidden sm:table-cell">Project</TableHead> : null}
            <TableHead>Type</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden text-right md:table-cell">Variables</TableHead>
            <TableHead className="hidden text-right md:table-cell">Services</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Reviewed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/environments/${e.id}`}
                    className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                  >
                    {e.name}
                  </Link>
                  {needsReview(e, renderedAt) ? <NeedsReviewFlag /> : null}
                </div>
              </TableCell>
              {showProject ? (
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  <Link
                    href={`/projects/${e.project_id}/environments`}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {e.project?.name}
                  </Link>
                </TableCell>
              ) : null}
              <TableCell>
                <EnvironmentBadge type={e.environment_type} variant="short" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <EnvironmentStatusBadge status={e.status} />
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {e.variableCount}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {e.instanceCount}
              </TableCell>
              <TableCell className="hidden text-right whitespace-nowrap text-muted-foreground lg:table-cell">
                {e.last_reviewed_at
                  ? formatRelative(e.last_reviewed_at, new Date(renderedAt))
                  : "Never"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
