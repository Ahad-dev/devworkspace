import Link from "next/link"
import { FolderKanban, SearchX } from "lucide-react"

import { PriorityBadge } from "@/components/shared/domain-badges"
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
import { formatRelative, taskProgress } from "@/lib/format"
import type { ProjectListFilters, listProjects } from "../queries"
import { ProjectStatusBadge, projectTypeLabel } from "./project-badges"
import { CreateProjectDialog } from "./create-project-dialog"

type Rows = Awaited<ReturnType<typeof listProjects>>

export function ProjectsTable({ rows, filters }: { rows: Rows; filters: ProjectListFilters }) {
  if (rows.length === 0) {
    const filtered = Boolean(filters.q || filters.type || filters.status)
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">{filtered ? <SearchX /> : <FolderKanban />}</EmptyMedia>
          <EmptyTitle>
            {filtered
              ? "No projects match these filters"
              : filters.view === "archived"
                ? "No archived projects"
                : "No projects yet"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Try a different search or clear the filters."
              : filters.view === "archived"
                ? "Archived projects show up here, with their data kept."
                : "Register a project to give its repositories, stack and docs a home."}
          </EmptyDescription>
        </EmptyHeader>
        {!filtered && filters.view === "active" ? (
          <EmptyContent>
            <CreateProjectDialog />
          </EmptyContent>
        ) : null}
      </Empty>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-56">Name</TableHead>
            {/* Secondary columns hide on small screens: name and status always fit. */}
            <TableHead className="hidden sm:table-cell">Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Priority</TableHead>
            <TableHead className="hidden text-right md:table-cell">Tasks</TableHead>
            <TableHead className="hidden text-right md:table-cell">Repos</TableHead>
            <TableHead className="hidden text-right md:table-cell">Stack</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/projects/${p.id}`}
                  className="underline-offset-4 outline-none hover:underline focus-visible:underline"
                >
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {p.project_type ? projectTypeLabel(p.project_type) : null}
              </TableCell>
              <TableCell>{p.status ? <ProjectStatusBadge status={p.status} /> : null}</TableCell>
              <TableCell className="hidden md:table-cell">
                {p.priority ? (
                  <PriorityBadge priority={p.priority} />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                <TaskProgress done={p.done_task_count ?? 0} total={p.task_count ?? 0} />
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {p.repository_count ?? 0}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {p.technology_count ?? 0}
              </TableCell>
              <TableCell className="hidden text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                {p.updated_at ? formatRelative(p.updated_at) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** "3/8" done with a percentage title; a dash when the project has no tasks. */
function TaskProgress({ done, total }: { done: number; total: number }) {
  const pct = taskProgress(done, total)
  if (pct === null) return <span className="text-muted-foreground">-</span>
  return (
    <span title={`${pct}% done`}>
      {done}/{total}
      <span className="sr-only"> tasks done</span>
    </span>
  )
}
