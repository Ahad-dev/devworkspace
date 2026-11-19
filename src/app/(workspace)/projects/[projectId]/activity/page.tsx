import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/profile/queries"
import { ActivityList } from "@/features/projects/components/activity-list"
import { ACTIVITY_PAGE_SIZE, getProject, listProjectActivity } from "@/features/projects/queries"

export const metadata: Metadata = { title: "Activity" }

/** Activity tab (Spec FR-13; Plan P2.10): paginated, newest first. */
export default function ActivityPage({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]/activity">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Activity params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Activity({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ projectId }, sp] = await Promise.all([params, searchParams])
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1)
  const project = await getProject(projectId)
  const [{ events, total }, profile] = await Promise.all([
    listProjectActivity(project.id, page),
    getMyProfile(),
  ])
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE))
  const base = `/projects/${project.id}/activity`

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ActivityList events={events} timeZone={profile.timezone} />
      {pages > 1 ? (
        <nav aria-label="Activity pages" className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}?page=${page - 1}`}>Newer</Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}?page=${page + 1}`}>Older</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
