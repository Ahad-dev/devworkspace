import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ServicesList } from "@/features/environments/components/services-panel"
import { listServices, listSiblingEnvironments } from "@/features/environments/queries"
import { getProject } from "@/features/projects/queries"
import { listAccountOptions } from "@/features/vault/queries"

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
  const [services, environments, accounts] = await Promise.all([
    listServices({ q: "", category: null }, { projectId: project.id }),
    listSiblingEnvironments(project.id),
    listAccountOptions(),
  ])
  const archived = project.status === "archived"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Accounts &amp; services</h2>
        {/* Plain-language explanation (Plan P10.5). */}
        <p className="text-sm text-muted-foreground">
          Outside products this project uses, such as a database, email sending or hosting, grouped
          by the account they run under. Add one here and tick the environments it runs in.
        </p>
        {environments.length === 0 && !archived ? (
          <p className="text-sm text-muted-foreground">
            Add environments first to link services to where they run.
          </p>
        ) : null}
      </div>
      <ServicesList
        accounts={accounts}
        services={services}
        projectId={archived ? undefined : project.id}
        environments={environments}
      />
    </div>
  )
}
