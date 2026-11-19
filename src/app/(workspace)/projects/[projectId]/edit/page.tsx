import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ProjectForm } from "@/features/projects/components/project-form"
import { getProject } from "@/features/projects/queries"

export const metadata: Metadata = { title: "Edit project" }

/** Full project edit page (Plan P2.7). */
export default function EditProjectPage({ params }: PageProps<"/projects/[projectId]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
      {params.then(({ projectId }) => (
        <EditForm projectId={projectId} />
      ))}
    </Suspense>
  )
}

async function EditForm({ projectId }: { projectId: string }) {
  const project = await getProject(projectId)
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Edit project details</h2>
      <ProjectForm project={project} />
    </div>
  )
}
