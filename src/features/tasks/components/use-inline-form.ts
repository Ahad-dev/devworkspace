"use client"

import * as React from "react"

import { initialFormState, type FormState } from "@/features/projects/schemas"
import { offlineFormState, whenOnline } from "@/lib/offline/guard"

/**
 * Small forms on the task page (comments, links, subtasks). Submits through the action
 * dispatcher, so a validation error keeps what was typed (React resets uncontrolled fields after
 * a form `action`), and clears the form only when the save succeeded.
 */
export function useInlineForm(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const formRef = React.useRef<HTMLFormElement>(null)
  const [state, dispatch, pending] = React.useActionState(
    (prev: FormState, formData: FormData) =>
      whenOnline(() => action(prev, formData), offlineFormState),
    initialFormState,
  )

  React.useEffect(() => {
    if (state.status === "success") formRef.current?.reset()
  }, [state])

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    React.startTransition(() => dispatch(data))
  }

  const error = (field?: string) =>
    state.status === "error" ? (field ? state.fieldErrors?.[field]?.[0] : state.message) : undefined

  return { state, pending, formRef, onSubmit, error }
}
