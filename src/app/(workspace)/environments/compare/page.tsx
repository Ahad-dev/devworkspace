import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeft, GitCompareArrows } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { ComparePicker, ComparisonTable } from "@/features/environments/components/comparison"
import { getComparisonData } from "@/features/environments/queries"
import { buildComparison } from "@/features/environments/utils"
import { listProjectOptions } from "@/features/tasks/queries"

export const metadata: Metadata = { title: "Compare environments" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Variable comparison across environments of one project (Spec FR-08; Plan P5.7). */
export default function ComparePage({ searchParams }: PageProps<"/environments/compare">) {
  return (
    <PageContainer>
      <Link
        href="/environments"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Environments
      </Link>
      <PageHeader
        title="Compare environments"
        description="Which variables each environment has, which required ones are missing or unconfirmed, and how each status was established. Values are never shown or stored."
      />
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <Compare searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function Compare({
  searchParams,
}: {
  searchParams: PageProps<"/environments/compare">["searchParams"]
}) {
  const sp = await searchParams
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? ""
  const projects = await listProjectOptions()
  const projectId =
    UUID.test(one("project")) && projects.some((p) => p.id === one("project"))
      ? one("project")
      : null

  if (!projectId) {
    return <ComparePicker projects={projects} projectId={null} environments={[]} selected={[]} />
  }

  const requested = one("envs")
    .split(",")
    .filter((id) => UUID.test(id))
  const first = await getComparisonData(projectId, requested)
  // No selection (or only one): compare every environment of the project, up to six.
  const ids =
    requested.length >= 2
      ? first.environments.filter((e) => requested.includes(e.id)).map((e) => e.id)
      : first.environments.slice(0, 6).map((e) => e.id)
  const data = ids.join() === requested.join() ? first : await getComparisonData(projectId, ids)
  const envs = data.environments.filter((e) => ids.includes(e.id))
  const rows = buildComparison(ids, data.variables)

  return (
    <div className="flex flex-col gap-4">
      <ComparePicker
        projects={projects}
        projectId={projectId}
        environments={data.environments}
        selected={ids}
      />
      {envs.length < 2 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitCompareArrows />
            </EmptyMedia>
            <EmptyTitle>Pick at least two environments</EmptyTitle>
            <EmptyDescription>
              This project has {data.environments.length} active environment
              {data.environments.length === 1 ? "" : "s"}. Add more on its Environments tab.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          None of these environments has variables yet.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {rows.length} variable{rows.length === 1 ? "" : "s"}
            {rows.some((r) => r.attention)
              ? ` · ${rows.filter((r) => r.attention).length} need attention (listed first)`
              : ""}
          </p>
          <ComparisonTable environments={envs} rows={rows} />
        </>
      )}
    </div>
  )
}
