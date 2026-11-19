import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { RepositoriesPanel } from "@/features/projects/components/repositories-panel"
import { getProject, listRepositories } from "@/features/projects/queries"

export const metadata: Metadata = { title: "Repositories" }

/** Repositories tab (Spec FR-04; Plan P2.9). */
export default function RepositoriesPage({
  params,
}: PageProps<"/projects/[projectId]/repositories">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ projectId }) => (
        <Repositories projectId={projectId} />
      ))}
    </Suspense>
  )
}

async function Repositories({ projectId }: { projectId: string }) {
  const project = await getProject(projectId)
  const repositories = await listRepositories(project.id)
  return <RepositoriesPanel projectId={project.id} repositories={repositories} />
}
