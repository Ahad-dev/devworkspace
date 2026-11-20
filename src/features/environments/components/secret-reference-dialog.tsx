"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import { SECRET_PROVIDERS } from "@/lib/constants/domain"
import { createSecretReference, updateSecretReference } from "../actions"
import type { SecretReferenceRow } from "../queries"

/**
 * Secret reference editor (Spec FR-08 secret-reference model; Plan P5.6): where a secret lives,
 * never the secret. Reusable across environments and projects.
 */
export function SecretReferenceDialog({
  open,
  onOpenChange,
  reference,
  defaultKeyName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this reference; omit to create one. */
  reference?: SecretReferenceRow
  defaultKeyName?: string
  onSaved?: (id: string) => void
}) {
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = reference
        ? await updateSecretReference(reference.id, prev, formData)
        : await createSecretReference(prev, formData)
      if (r.status === "success") {
        toast.success(r.message ?? "Saved")
        onSaved?.((r.data as { id?: string } | undefined)?.id ?? reference?.id ?? "")
        onOpenChange(false)
      }
      return r
    },
    initialFormState,
  )
  const err = (k: string) => toFieldErrors(state.fieldErrors?.[k])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => dispatch(data))
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {reference ? "Edit secret reference" : "New secret reference"}
            </DialogTitle>
            <DialogDescription>
              Where the secret is stored in your vault. DevWorkspace never stores the secret or a
              token that can read it.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.provider)}>
              <FieldLabel htmlFor="ref-provider">Provider</FieldLabel>
              <Input
                id="ref-provider"
                name="provider"
                list="secret-providers"
                defaultValue={reference?.provider ?? ""}
                maxLength={60}
                placeholder="Doppler"
                autoFocus
              />
              <datalist id="secret-providers">
                {SECRET_PROVIDERS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <FieldError errors={err("provider")} />
            </Field>
            <Field data-invalid={Boolean(state.fieldErrors?.vault_project_or_workspace)}>
              <FieldLabel htmlFor="ref-workspace">Vault project or workspace</FieldLabel>
              <Input
                id="ref-workspace"
                name="vault_project_or_workspace"
                defaultValue={reference?.vault_project_or_workspace ?? ""}
                maxLength={200}
                placeholder="client-portal"
              />
              <FieldError errors={err("vault_project_or_workspace")} />
            </Field>
            <Field data-invalid={Boolean(state.fieldErrors?.vault_path_or_item_id)}>
              <FieldLabel htmlFor="ref-path">Path or item id</FieldLabel>
              <Input
                id="ref-path"
                name="vault_path_or_item_id"
                defaultValue={reference?.vault_path_or_item_id ?? ""}
                maxLength={500}
                placeholder="prd or op://Engineering/Portal DB"
                className="font-mono text-sm"
              />
              <FieldError errors={err("vault_path_or_item_id")} />
            </Field>
            <Field data-invalid={Boolean(state.fieldErrors?.key_name)}>
              <FieldLabel htmlFor="ref-key">Key name</FieldLabel>
              <Input
                id="ref-key"
                name="key_name"
                defaultValue={reference?.key_name ?? defaultKeyName ?? ""}
                maxLength={200}
                placeholder="DATABASE_URL"
                className="font-mono text-sm"
              />
              <FieldError errors={err("key_name")} />
            </Field>
            <Field data-invalid={Boolean(state.fieldErrors?.vault_url)}>
              <FieldLabel htmlFor="ref-url">Vault URL</FieldLabel>
              <Input
                id="ref-url"
                name="vault_url"
                type="url"
                defaultValue={reference?.vault_url ?? ""}
                maxLength={2048}
                placeholder="https://dashboard.doppler.com/…"
              />
              <FieldDescription>
                A link to the item in the vault, without credentials.
              </FieldDescription>
              <FieldError errors={err("vault_url")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {reference ? "Save reference" : "Add reference"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function describeReference(
  r: Pick<
    SecretReferenceRow,
    "provider" | "vault_project_or_workspace" | "vault_path_or_item_id" | "key_name"
  >,
) {
  return [r.provider, r.vault_project_or_workspace, r.vault_path_or_item_id, r.key_name]
    .filter(Boolean)
    .join(" / ")
}
