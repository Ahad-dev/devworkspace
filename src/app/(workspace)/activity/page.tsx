import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FEED_PAGE_SIZE, listActivityFeed } from "@/features/dashboard/queries"
import { getMyProfile } from "@/features/profile/queries"
import { ActivityList } from "@/features/projects/components/activity-list"
import { requestTime } from "@/lib/request-time"

export const metadata: Metadata = { title: "Activity" }

/** Activity across every project (Spec FR-13; Plan P7.6), newest first. */
export default function ActivityPage({ searchParams }: PageProps<"/activity">) {
  return (
    <PageContainer>
      <PageHeader
        title="Activity"
        description="What changed across your projects. Names and statuses only, never secret values."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl" />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function Feed({ searchParams }: { searchParams: PageProps<"/activity">["searchParams"] }) {
  const sp = await searchParams
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1)
  const [{ events, total }, profile, now] = await Promise.all([
    listActivityFeed(page),
    getMyProfile(),
    requestTime(),
  ])
  const pages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE))

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ActivityList events={events} timeZone={profile.timezone} showContext now={now} />
      {pages > 1 ? (
        <nav aria-label="Activity pages" className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/activity?page=${page - 1}`}>Newer</Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/activity?page=${page + 1}`}>Older</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
