"use client"

import { useEffect } from "react"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Log only the message/digest, never request payloads (Spec §9.5).
    const digest = (error as { digest?: string } | null)?.digest
    console.error("Workspace error", digest ?? (error instanceof Error ? error.message : error))
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            This page couldn&apos;t load. Your data is safe. Try again, and if it keeps happening,
            reload the page.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" onClick={() => retry()}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
