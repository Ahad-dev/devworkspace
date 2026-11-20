import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { QuickTaskDialog } from "@/features/tasks/components/quick-task-dialog"
import { TaskWorkspace } from "@/features/tasks/components/task-workspace"
import { listProjectOptions } from "@/features/tasks/queries"

export const metadata: Metadata = { title: "My Work" }

/** Global task queue (Spec FR-06, §6.5–6.6; Plan P3.7). */
export default function MyWorkPage({ searchParams }: PageProps<"/my-work">) {
  return (
    <PageContainer>
      <PageHeader
        title="My Work"
        description="Every task across your projects in one queue."
        actions={
          <Suspense fallback={<Skeleton className="h-7 w-44" />}>
            <CreateActions />
          </Suspense>
        }
      />
      <TaskWorkspace searchParams={searchParams} basePath="/my-work" />
    </PageContainer>
  )
}

async function CreateActions() {
  const projects = await listProjectOptions()
  return (
    <>
      <QuickTaskDialog projects={projects} />
      <Link href="/tasks/new" className={buttonVariants({ size: "sm" })}>
        <Plus />
        New task
      </Link>
    </>
  )
}
