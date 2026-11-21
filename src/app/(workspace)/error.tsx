"use client"

import { useEffect } from "react"
import { TriangleAlert, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { isNetworkError, isOffline } from "@/lib/offline/guard"

export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Log only the message/digest, never request payloads (Spec §9.5).
    const digest = (error as { digest?: string } | null)?.digest
    console.error("Workspace error", digest ?? (error instanceof Error ? error.message : error))
  }, [error])

  // A request that couldn't reach the server (Plan P9.5): say so, and point to the saved copy.
  const offline = isOffline() || isNetworkError(error)

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{offline ? <WifiOff /> : <TriangleAlert />}</EmptyMedia>
          <EmptyTitle>{offline ? "You're offline" : "Something went wrong"}</EmptyTitle>
          <EmptyDescription>
            {offline
              ? "This page needs a connection, and changes can't be saved until you reconnect. Your saved copy of tasks is still available."
              : "This page couldn't load. Your data is safe. Try again, and if it keeps happening, reload the page."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={() => retry()}>
              Try again
            </Button>
            {offline ? (
              <Button size="sm" variant="outline" asChild>
                <a href="/my-work">Open saved tasks</a>
              </Button>
            ) : null}
          </div>
        </EmptyContent>
      </Empty>
    </div>
  )
}
