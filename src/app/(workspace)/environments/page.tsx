import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { GitCompareArrows } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EnvironmentFilters } from "@/features/environments/components/environment-filters"
import { EnvironmentsTable } from "@/features/environments/components/environments-table"
import { listEnvironments, parseEnvironmentFilters } from "@/features/environments/queries"
import { requestTime } from "@/lib/request-time"

export const metadata: Metadata = { title: "Environments" }

/**
 * All environments across projects, to review and compare (Spec FR-08; Plan P5.4). References to
 * other vaults moved to Accounts in P12.4.
 */
export default function EnvironmentsPage({ searchParams }: PageProps<"/environments">) {
  return (
    <PageContainer>
      <PageHeader
        title="Environments"
        description="How each project runs in each place, and what configuration it needs. Secret values stay in your vault."
        actions={
          <Link
            href="/environments/compare"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <GitCompareArrows />
            Compare
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-9 w-full max-w-2xl" />}>
        <EnvironmentFilters />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function Results({
  searchParams,
}: {
  searchParams: PageProps<"/environments">["searchParams"]
}) {
  const filters = parseEnvironmentFilters(await searchParams)
  const [rows, renderedAt] = await Promise.all([listEnvironments(filters), requestTime()])
  return (
    <EnvironmentsTable
      rows={rows}
      filters={filters}
      showProject
      renderedAt={renderedAt}
      emptyAction={
        <Link href="/projects" className={buttonVariants({ size: "sm" })}>
          Open a project to add one
        </Link>
      }
    />
  )
}
