import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductionBanner } from "@/features/environments/components/env-badges"
import { EnvironmentForm } from "@/features/environments/components/environment-form"
import { getEnvironment } from "@/features/environments/queries"

export const metadata: Metadata = { title: "Edit environment" }

export default function EditEnvironmentPage({
  params,
}: PageProps<"/environments/[environmentId]/edit">) {
  return (
    <PageContainer>
      <Suspense fallback={<Skeleton className="h-[36rem] w-full max-w-3xl" />}>
        {params.then(({ environmentId }) => (
          <EditEnvironment environmentId={environmentId} />
        ))}
      </Suspense>
    </PageContainer>
  )
}

async function EditEnvironment({ environmentId }: { environmentId: string }) {
  const env = await getEnvironment(environmentId)
  return (
    <>
      <Link
        href={`/environments/${env.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back to {env.name}
      </Link>
      <PageHeader title={`Edit ${env.name}`} description={`In ${env.project.name}`} />
      {env.environment_type === "production" ? <ProductionBanner /> : null}
      <EnvironmentForm environment={env} />
    </>
  )
}
