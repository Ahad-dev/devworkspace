"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { switchSessions } from "../actions"

/**
 * Spec FR-07: starting while another session runs must offer to pause or finish it, never
 * create overlapping timers. Notes for the other task can be added later from its page.
 */
export function SwitchSessionDialog({
  open,
  onOpenChange,
  activeSessionId,
  activeTaskTitle,
  next,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeSessionId: string
  activeTaskTitle?: string | null
  next: { taskId: string } | { resumeSessionId: string }
}) {
  const [pending, startTransition] = React.useTransition()

  function go(mode: "pause" | "complete") {
    startTransition(async () => {
      const r = await switchSessions({ activeSessionId, mode, ...next })
      if (r.ok) {
        toast.success(mode === "pause" ? "Paused the other session" : "Finished the other session")
        onOpenChange(false)
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Another session is running</AlertDialogTitle>
          <AlertDialogDescription>
            {activeTaskTitle ? (
              <>
                You&apos;re working on{" "}
                <span className="font-medium text-foreground">{activeTaskTitle}</span>.{" "}
              </>
            ) : null}
            Only one session runs at a time. Pause it to come back later, or finish it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="outline" disabled={pending} onClick={() => go("complete")}>
            Finish it and switch
          </Button>
          <Button disabled={pending} onClick={() => go("pause")}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Pause it and switch
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
