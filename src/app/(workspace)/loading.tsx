import { Skeleton } from "@/components/ui/skeleton"
import { PageContainer } from "@/components/shared/page-header"

export default function Loading() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-64 w-full" />
    </PageContainer>
  )
}
