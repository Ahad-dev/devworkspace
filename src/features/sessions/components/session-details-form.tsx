"use client"

import * as React from "react"
import { Loader2, Settings2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import { updateSessionDetails } from "../actions"
import { offlineFormState, whenOnline } from "@/lib/offline/guard"

const NONE = "none"

/** Branch (manual in MVP), repository and notes for a session (Spec FR-07 session fields). */
export function SessionDetailsForm({
  sessionId,
  branchName,
  notes,
  repositoryId,
  repositories,
}: {
  sessionId: string
  branchName: string | null
  notes: string | null
  repositoryId: string | null
  repositories: { id: string; name: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = await whenOnline(
        () => updateSessionDetails(sessionId, prev, formData),
        offlineFormState,
      )
      if (r.status === "success") {
        toast.success("Session details saved")
        setOpen(false)
      }
      return r
    },
    initialFormState,
  )
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[k]?.[0] : undefined)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs">
          <Settings2 />
          Details
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => dispatch(data))
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-branch">Branch</Label>
            <Input
              id="session-branch"
              name="branch_name"
              defaultValue={branchName ?? ""}
              maxLength={255}
              placeholder="feat/rate-limiting"
              className="font-mono text-sm"
              aria-invalid={Boolean(err("branch_name"))}
            />
            {err("branch_name") ? (
              <p role="alert" className="text-xs text-destructive">
                {err("branch_name")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-repo">Repository</Label>
            <Select name="repository_id" defaultValue={repositoryId ?? NONE}>
              <SelectTrigger id="session-repo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {repositories.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-notes">Session notes</Label>
            <Textarea
              id="session-notes"
              name="notes"
              defaultValue={notes ?? ""}
              maxLength={10000}
              rows={3}
              aria-invalid={Boolean(err("notes"))}
            />
            {err("notes") ? (
              <p role="alert" className="text-xs text-destructive">
                {err("notes")}
              </p>
            ) : null}
          </div>
          {state.status === "error" && state.message ? (
            <p role="alert" className="text-xs text-destructive">
              {state.message}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={pending} className="w-fit">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
