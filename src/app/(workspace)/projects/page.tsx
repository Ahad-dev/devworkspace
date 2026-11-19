import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog"
import { ProjectFilters } from "@/features/projects/components/project-filters"
import { ProjectsTable } from "@/features/projects/components/projects-table"
import { listProjects, parseProjectFilters } from "@/features/projects/queries"

export const metadata: Metadata = { title: "Projects" }

/** Spec FR-03 / §6.3. Filters come from the URL; the table renders on the server. */
export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Your software projects and their technical context."
        actions={<CreateProjectDialog />}
      />
      <Suspense fallback={<Skeleton className="h-9 w-full max-w-2xl" />}>
        <ProjectFilters />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ProjectsResults searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function ProjectsResults({
  searchParams,
}: {
  searchParams: PageProps<"/projects">["searchParams"]
}) {
  const filters = parseProjectFilters(await searchParams)
  const rows = await listProjects(filters)
  return <ProjectsTable rows={rows} filters={filters} />
}
