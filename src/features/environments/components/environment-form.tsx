"use client"

import * as React from "react"
import { useActionState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState } from "@/features/projects/schemas"
import {
  EDITABLE_ENVIRONMENT_STATUSES,
  ENVIRONMENT_STATUS_META,
  ENVIRONMENT_TYPE_META,
  ENVIRONMENT_TYPES,
} from "@/lib/constants/domain"
import type { Database } from "@/types/database.types"
import { updateEnvironment } from "../actions"
import { formatRuntimeVersions } from "../utils"

type Environment = Database["public"]["Tables"]["environments"]["Row"]

/** Full environment form (Spec FR-08 fields). Non-secret metadata only. */
export function EnvironmentForm({ environment }: { environment: Environment }) {
  const [state, dispatch, pending] = useActionState(
    updateEnvironment.bind(null, environment.id),
    initialFormState,
  )
  const err = (k: string) => state.fieldErrors?.[k]
  const archived = environment.status === "archived"

  const text = (
    name: keyof Environment,
    label: string,
    opts: {
      placeholder?: string
      max?: number
      type?: string
      description?: string
      mono?: boolean
    } = {},
  ) => (
    <Field data-invalid={Boolean(err(name))}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        type={opts.type}
        defaultValue={(environment[name] as string | null) ?? ""}
        maxLength={opts.max}
        placeholder={opts.placeholder}
        className={opts.mono ? "font-mono text-sm" : undefined}
        aria-invalid={Boolean(err(name))}
      />
      {opts.description ? <FieldDescription>{opts.description}</FieldDescription> : null}
      <FieldError errors={toFieldErrors(err(name))} />
    </Field>
  )

  return (
    <form
      // Dispatch instead of the action prop so a validation error keeps what was typed.
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        React.startTransition(() => dispatch(data))
      }}
      className="flex max-w-3xl flex-col gap-6"
      noValidate
    >
      {state.status === "error" && state.message ? (
        <FormMessage status="error">{state.message}</FormMessage>
      ) : null}

      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="sm:col-span-1">{text("name", "Name", { max: 100 })}</div>
          <Field data-invalid={Boolean(err("environment_type"))}>
            <FieldLabel htmlFor="environment_type">Type</FieldLabel>
            <Select name="environment_type" defaultValue={environment.environment_type}>
              <SelectTrigger id="environment_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENVIRONMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ENVIRONMENT_TYPE_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!archived ? (
            <Field data-invalid={Boolean(err("status"))}>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select name="status" defaultValue={environment.status}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_ENVIRONMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ENVIRONMENT_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {text("application_url", "Application URL", {
            type: "url",
            max: 2048,
            placeholder: "https://staging.example.com",
          })}
          {text("api_url", "API URL", {
            type: "url",
            max: 2048,
            placeholder: "https://api.staging.example.com",
          })}
          {text("deployment_provider", "Deployment provider", {
            max: 100,
            placeholder: "Vercel, Fly.io, VPS…",
          })}
          {text("server_hostname", "Server hostname or IP", {
            max: 255,
            placeholder: "10.0.0.12 or app-1.internal:8080",
            description: "Hostname or IP only. No user@, scheme or path.",
            mono: true,
          })}
          {text("operating_system", "Operating system", { max: 100, placeholder: "Ubuntu 24.04" })}
          {text("machine_label", "Machine label", {
            max: 100,
            placeholder: "Work laptop",
            description: "For local or custom environments.",
          })}
          {text("deployment_branch", "Deployment branch", {
            max: 255,
            placeholder: "main",
            mono: true,
          })}
          <Field data-invalid={Boolean(err("runtime_versions"))}>
            <FieldLabel htmlFor="runtime_versions">Runtime versions</FieldLabel>
            <Input
              id="runtime_versions"
              name="runtime_versions"
              defaultValue={formatRuntimeVersions(environment.runtime_versions)}
              placeholder="node 24.11, pnpm 10.33"
              className="font-mono text-sm"
              aria-invalid={Boolean(err("runtime_versions"))}
            />
            <FieldDescription>Comma-separated name and version pairs.</FieldDescription>
            <FieldError errors={toFieldErrors(err("runtime_versions"))} />
          </Field>
        </div>

        <Field data-invalid={Boolean(err("deployment_method"))}>
          <FieldLabel htmlFor="deployment_method">Deployment method</FieldLabel>
          <Textarea
            id="deployment_method"
            name="deployment_method"
            defaultValue={environment.deployment_method ?? ""}
            maxLength={2000}
            rows={2}
            placeholder="Push to main deploys through Vercel; migrations run with pnpm db:push"
            aria-invalid={Boolean(err("deployment_method"))}
          />
          <FieldError errors={toFieldErrors(err("deployment_method"))} />
        </Field>
        <Field data-invalid={Boolean(err("notes"))}>
          <FieldLabel htmlFor="notes">Setup and deployment notes</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={environment.notes ?? ""}
            maxLength={20000}
            rows={8}
            placeholder="How to set this environment up, where things live, gotchas…"
            aria-invalid={Boolean(err("notes"))}
          />
          <FieldDescription>
            Reference where secrets live (e.g. &quot;Doppler: portal/prd&quot;), never their values.
          </FieldDescription>
          <FieldError errors={toFieldErrors(err("notes"))} />
        </Field>
      </FieldGroup>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save environment
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/environments/${environment.id}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
