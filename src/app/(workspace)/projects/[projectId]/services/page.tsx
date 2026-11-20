import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ServicesList } from "@/features/environments/components/services-panel"
import { listServices, listSiblingEnvironments } from "@/features/environments/queries"
import { getProject } from "@/features/projects/queries"

export const metadata: Metadata = { title: "Services" }

/** Project Services tab (Spec FR-09; Plan P5.8): define once, link to each environment. */
export default function ProjectServicesPage({
  params,
}: PageProps<"/projects/[projectId]/services">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      {params.then(({ projectId }) => (
        <ProjectServices projectId={projectId} />
      ))}
    </Suspense>
  )
}

async function ProjectServices({ projectId }: { projectId: string }) {
  const project = await getProject(projectId)
  const [services, environments] = await Promise.all([
    listServices({ q: "", category: null }, { projectId: project.id }),
    listSiblingEnvironments(project.id),
  ])
  const archived = project.status === "archived"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Services</h2>
        {environments.length === 0 && !archived ? (
          <p className="text-sm text-muted-foreground">
            Add environments first to link services to where they run.
          </p>
        ) : null}
      </div>
      <ServicesList
        services={services}
        projectId={archived ? undefined : project.id}
        environments={environments}
      />
    </div>
  )
}
