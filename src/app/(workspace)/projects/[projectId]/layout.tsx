import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageContainer } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectStatusBadge, projectTypeLabel } from "@/features/projects/components/project-badges"
import { ProjectActions } from "@/features/projects/components/project-actions"
import { ProjectTabs } from "@/features/projects/components/project-tabs"
import { getProject, getProjectCounts } from "@/features/projects/queries"

/**
 * Project workspace shell (Spec FR-03 tabs). params is request data under Cache Components, so it's
 * passed down as a promise and awaited inside Suspense boundaries, never at the layout's top level.
 */
export default function ProjectLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  return (
    <PageContainer className="gap-4">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All projects
      </Link>
      <Suspense fallback={<Skeleton className="h-14 w-full max-w-xl" />}>
        <ProjectHeader params={params} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        {params.then(({ projectId }) => (
          <ProjectTabs projectId={projectId} />
        ))}
      </Suspense>
      <div className="pt-2">{children}</div>
    </PageContainer>
  )
}

async function ProjectHeader({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const [project, counts] = await Promise.all([getProject(projectId), getProjectCounts(projectId)])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="truncate text-xl font-semibold tracking-tight">{project.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <ProjectStatusBadge status={project.status} />
          <span>{projectTypeLabel(project.project_type)}</span>
        </div>
      </div>
      <ProjectActions
        projectId={project.id}
        projectName={project.name}
        archived={project.status === "archived"}
        counts={counts}
      />
    </div>
  )
}
