import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { GitCompareArrows } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateEnvironmentDialog } from "@/features/environments/components/create-environment-dialog"
import { EnvironmentFilters } from "@/features/environments/components/environment-filters"
import { EnvironmentsTable } from "@/features/environments/components/environments-table"
import { listEnvironments, parseEnvironmentFilters } from "@/features/environments/queries"
import { getProject } from "@/features/projects/queries"
import { requestTime } from "@/lib/request-time"

export const metadata: Metadata = { title: "Environments" }

/** Project Environments tab (Plan P5.4). */
export default function ProjectEnvironmentsPage({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]/environments">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      {params.then(({ projectId }) => (
        <ProjectEnvironments projectId={projectId} searchParams={searchParams} />
      ))}
    </Suspense>
  )
}

async function ProjectEnvironments({
  projectId,
  searchParams,
}: {
  projectId: string
  searchParams: PageProps<"/projects/[projectId]/environments">["searchParams"]
}) {
  const project = await getProject(projectId)
  const filters = parseEnvironmentFilters(await searchParams)
  const [rows, renderedAt] = await Promise.all([
    listEnvironments(filters, { projectId: project.id }),
    requestTime(),
  ])
  const archived = project.status === "archived"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Environments</h2>
          {/* Plain-language explanation (Plan P10.5). */}
          <p className="text-sm text-muted-foreground">
            The places this project runs, such as your computer, staging and production. Each one
            lists its address, the variable names it needs and the services it uses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/environments/compare?project=${project.id}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <GitCompareArrows />
            Compare
          </Link>
          {!archived ? <CreateEnvironmentDialog projectId={project.id} /> : null}
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-9 w-full max-w-2xl" />}>
        <EnvironmentFilters />
      </Suspense>
      <EnvironmentsTable
        rows={rows}
        filters={filters}
        showProject={false}
        renderedAt={renderedAt}
        emptyAction={!archived ? <CreateEnvironmentDialog projectId={project.id} /> : undefined}
      />
    </div>
  )
}
