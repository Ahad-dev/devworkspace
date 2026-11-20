import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { ServiceFilters } from "@/features/environments/components/service-filters"
import { ServicesList } from "@/features/environments/components/services-panel"
import { listServices, parseServiceFilters } from "@/features/environments/queries"

export const metadata: Metadata = { title: "Services" }

/** Services across all projects (Spec FR-09: "services can be searched globally"; Plan P5.8). */
export default function ServicesPage({ searchParams }: PageProps<"/services">) {
  return (
    <PageContainer>
      <PageHeader
        title="Services"
        description="Databases, caches, storage, auth and other providers across your projects, and where each runs."
      />
      <Suspense fallback={<Skeleton className="h-9 w-full max-w-xl" />}>
        <ServiceFilters />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function Results({ searchParams }: { searchParams: PageProps<"/services">["searchParams"] }) {
  const filters = parseServiceFilters(await searchParams)
  const services = await listServices(filters)
  if (services.length === 0 && (filters.q || filters.category)) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No services match. Try another name, provider or category.
      </p>
    )
  }
  return <ServicesList services={services} showProject />
}
