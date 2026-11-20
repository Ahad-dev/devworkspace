"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormMessage } from "@/features/auth/components/form-message"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import type { TaskViewDefaults } from "@/features/tasks/utils"
import { saveTaskViewDefaults } from "../actions"

const SORT_LABELS: Record<TaskViewDefaults["sort"], string> = {
  priority: "Priority",
  due: "Due date",
  updated: "Recently updated",
  title: "Title",
}

/** Default task view (Spec §6.11): how My Work and project task tabs open. */
export function TaskViewForm({ defaults }: { defaults: TaskViewDefaults }) {
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = await saveTaskViewDefaults(prev, formData)
      if (r.status === "success") toast.success(r.message ?? "Saved")
      return r
    },
    initialFormState,
  )

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        React.startTransition(() => dispatch(data))
      }}
    >
      {state.status === "error" && state.message ? (
        <FormMessage status="error">{state.message}</FormMessage>
      ) : null}
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="task-view-layout">Layout</FieldLabel>
          <Select name="layout" defaultValue={defaults.layout}>
            <SelectTrigger id="task-view-layout" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">List</SelectItem>
              <SelectItem value="board">Board</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="task-view-sort">Sort lists by</FieldLabel>
          <Select name="sort" defaultValue={defaults.sort}>
            <SelectTrigger id="task-view-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as TaskViewDefaults["sort"][]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <FieldDescription>
        Links and the view switcher still override this for one visit.
      </FieldDescription>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save default view
        </Button>
      </div>
    </form>
  )
}
