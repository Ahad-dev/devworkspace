"use client"

import * as React from "react"
import Link from "next/link"
import { Boxes, ExternalLink, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { EnvironmentBadge } from "@/components/shared/domain-badges"
import { Button } from "@/components/ui/button"
import { MoreDetails } from "@/components/shared/more-details"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  SERVICE_INSTANCE_STATUSES,
  SERVICE_INSTANCE_STATUS_META,
  type EnvironmentType,
  type ServiceCategory,
  type ServiceInstanceStatus,
} from "@/lib/constants/domain"
import {
  addInstance,
  createService,
  deleteService,
  removeInstance,
  updateInstance,
  updateService,
} from "../actions"
import type { ServiceRow } from "../queries"
import { InstanceStatusBadge } from "./env-badges"

type Option = { id: string; name: string }
type EnvOption = Option & { environment_type: EnvironmentType }

type Instance = {
  id: string
  resource_name: string | null
  region: string | null
  endpoint_hostname: string | null
  version_or_plan: string | null
  status: ServiceInstanceStatus
  related_variables: string[]
  notes: string | null
}

function ExternalLinkSmall({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

/* Services list (project tab and global /services; Plan P5.8) ------------------ */

export function ServicesList({
  services,
  projectId,
  environments,
  showProject,
  accounts = [],
}: {
  services: ServiceRow[]
  /** Set on a project's tab: enables add/edit. */
  projectId?: string
  environments?: EnvOption[]
  showProject?: boolean
  /** Account choices for the service dialog (Plan P11.4). */
  accounts?: Option[]
}) {
  const [dialog, setDialog] = React.useState<
    | { kind: "service"; service?: ServiceRow }
    | { kind: "instance"; service: ServiceRow; instance?: Instance & { environment_id: string } }
    | null
  >(null)
  const [key, setKey] = React.useState(0)
  const [pending, startTransition] = React.useTransition()
  const open = (d: NonNullable<typeof dialog>) => {
    setKey((k) => k + 1)
    setDialog(d)
  }

  return (
    <div className="flex flex-col gap-3">
      {projectId ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => open({ kind: "service" })}>
            <Plus />
            Add service
          </Button>
        </div>
      ) : null}

      {services.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
          <Boxes className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No services yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Register the databases, caches, storage, auth and other providers{" "}
            {projectId ? "this project" : "your projects"} use, then link each to the environments
            where it runs.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupByAccount(services, Boolean(projectId)).map((group) => (
            <section
              key={group.key}
              aria-label={group.title ?? "Services"}
              className="flex flex-col gap-2"
            >
              {group.title ? (
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <KeyRound className="size-3.5 text-muted-foreground" aria-hidden />
                  {group.href ? (
                    <Link href={group.href} className="underline-offset-4 hover:underline">
                      {group.title}
                    </Link>
                  ) : (
                    group.title
                  )}
                </h3>
              ) : null}
              <ul className="flex flex-col divide-y rounded-lg border">
                {group.services.map((s) => (
                  <li key={s.id} className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="font-medium">
                          {s.name}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {SERVICE_CATEGORY_LABELS[s.category]}
                            {s.provider ? ` · ${s.provider}` : ""}
                          </span>
                        </p>
                        {s.account ? (
                          <Link
                            href={`/accounts/${s.account.id}`}
                            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                          >
                            <KeyRound className="size-3" aria-hidden />
                            {s.account.label
                              ? `${s.account.platform} (${s.account.label})`
                              : s.account.platform}
                          </Link>
                        ) : null}
                        {showProject && s.project ? (
                          <Link
                            href={`/projects/${s.project_id}/services`}
                            className="w-fit text-xs text-muted-foreground underline-offset-4 hover:underline"
                          >
                            {s.project.name}
                          </Link>
                        ) : null}
                        {s.purpose ? (
                          <p className="text-sm text-muted-foreground">{s.purpose}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-3">
                          {s.dashboard_url ? (
                            <ExternalLinkSmall href={s.dashboard_url}>Dashboard</ExternalLinkSmall>
                          ) : null}
                          {s.documentation_url ? (
                            <ExternalLinkSmall href={s.documentation_url}>Docs</ExternalLinkSmall>
                          ) : null}
                        </div>
                      </div>
                      {projectId ? (
                        <div className="flex gap-1">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => open({ kind: "instance", service: s })}
                            disabled={!environments?.length}
                          >
                            <Plus />
                            Add to environment
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Edit ${s.name}`}
                            onClick={() => open({ kind: "service", service: s })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Remove ${s.name}`}
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                if (!window.confirm(`Remove ${s.name} and its environment links?`))
                                  return
                                const r = await deleteService({ projectId, serviceId: s.id })
                                if (r.ok) toast.success(`Removed ${s.name}`)
                                else toast.error(r.error)
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {s.instances.length ? (
                      <ul className="flex flex-col gap-1.5">
                        {s.instances.map((i) => (
                          <li
                            key={i.id}
                            className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
                          >
                            <EnvironmentBadge
                              type={i.environment!.environment_type}
                              variant="short"
                            />
                            <Link
                              href={`/environments/${i.environment_id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {i.environment!.name}
                            </Link>
                            <InstanceStatusBadge status={i.status} />
                            {i.resource_name ? (
                              <span className="text-muted-foreground">{i.resource_name}</span>
                            ) : null}
                            {i.region ? (
                              <span className="text-xs text-muted-foreground">{i.region}</span>
                            ) : null}
                            {i.endpoint_hostname ? (
                              <span className="truncate font-mono text-xs text-muted-foreground">
                                {i.endpoint_hostname}
                              </span>
                            ) : null}
                            {projectId ? (
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="ml-auto"
                                aria-label={`Edit ${s.name} in ${i.environment!.name}`}
                                onClick={() => open({ kind: "instance", service: s, instance: i })}
                              >
                                <Pencil />
                              </Button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Not linked to any environment yet.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {projectId && dialog?.kind === "service" ? (
        <ServiceDialog
          key={key}
          projectId={projectId}
          service={dialog.service}
          accounts={accounts}
          environments={environments ?? []}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {projectId && dialog?.kind === "instance" ? (
        <InstanceDialog
          key={key}
          projectId={projectId}
          services={[{ id: dialog.service.id, name: dialog.service.name }]}
          environments={(environments ?? []).filter(
            (e) =>
              dialog.instance?.environment_id === e.id ||
              !dialog.service.instances.some((i) => i.environment_id === e.id),
          )}
          fixedServiceId={dialog.service.id}
          fixedEnvironmentId={dialog.instance?.environment_id}
          instance={dialog.instance}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}

/* Environment detail: the services running here (Spec §6.9) -------------------- */

export function EnvironmentInstances({
  projectId,
  environmentId,
  instances,
  services,
  readOnly,
}: {
  projectId: string
  environmentId: string
  instances: (Instance & {
    project_service_id: string
    service: {
      id: string
      name: string
      category: ServiceCategory
      provider: string | null
      dashboard_url: string | null
      documentation_url: string | null
    } | null
  })[]
  /** The project's service definitions, for "Add service". */
  services: Option[]
  readOnly?: boolean
}) {
  const [dialog, setDialog] = React.useState<{ instance?: (typeof instances)[number] } | null>(null)
  const [key, setKey] = React.useState(0)
  const [pending, startTransition] = React.useTransition()
  const linked = new Set(instances.map((i) => i.project_service_id))
  const available = services.filter((s) => !linked.has(s.id))

  return (
    <div className="flex flex-col gap-3">
      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/projects/${projectId}/services`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Manage project services
          </Link>
          <Button
            size="sm"
            variant="outline"
            disabled={available.length === 0}
            title={
              available.length === 0
                ? "Define services on the project's Services tab first"
                : undefined
            }
            onClick={() => {
              setKey((k) => k + 1)
              setDialog({})
            }}
          >
            <Plus />
            Add service
          </Button>
        </div>
      ) : null}
      {instances.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No services linked. Add the database, cache, storage and other services this environment
          uses{services.length === 0 ? " (define them on the project's Services tab first)" : ""}.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {instances.map((i) => (
            <li key={i.id} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.service?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {i.service ? SERVICE_CATEGORY_LABELS[i.service.category] : ""}
                  {i.service?.provider ? ` · ${i.service.provider}` : ""}
                </span>
                <InstanceStatusBadge status={i.status} />
                {!readOnly ? (
                  <span className="ml-auto flex gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Edit ${i.service?.name}`}
                      onClick={() => {
                        setKey((k) => k + 1)
                        setDialog({ instance: i })
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Remove ${i.service?.name} from this environment`}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await removeInstance({ projectId, instanceId: i.id })
                          if (r.ok) toast.success("Removed")
                          else toast.error(r.error)
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </span>
                ) : null}
              </div>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {[
                  ["Resource", i.resource_name],
                  ["Region", i.region],
                  ["Endpoint", i.endpoint_hostname],
                  ["Version / plan", i.version_or_plan],
                ]
                  .filter(([, v]) => v)
                  .map(([label, v]) => (
                    <div key={label} className="flex gap-2">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd
                        className={
                          label === "Endpoint" ? "truncate font-mono text-xs leading-5" : ""
                        }
                      >
                        {v}
                      </dd>
                    </div>
                  ))}
              </dl>
              {i.related_variables.length ? (
                <p className="flex flex-wrap gap-1 text-xs">
                  <span className="text-muted-foreground">Uses</span>
                  {i.related_variables.map((n) => (
                    <code key={n} className="rounded bg-muted px-1">
                      {n}
                    </code>
                  ))}
                </p>
              ) : null}
              {i.notes ? (
                <p className="text-xs whitespace-pre-wrap text-muted-foreground">{i.notes}</p>
              ) : null}
              <div className="flex gap-3">
                {i.service?.dashboard_url ? (
                  <ExternalLinkSmall href={i.service.dashboard_url}>Dashboard</ExternalLinkSmall>
                ) : null}
                {i.service?.documentation_url ? (
                  <ExternalLinkSmall href={i.service.documentation_url}>Docs</ExternalLinkSmall>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog ? (
        <InstanceDialog
          key={key}
          projectId={projectId}
          services={
            dialog.instance
              ? services.filter((s) => s.id === dialog.instance!.project_service_id)
              : available
          }
          environments={[]}
          fixedEnvironmentId={environmentId}
          fixedServiceId={dialog.instance?.project_service_id}
          instance={dialog.instance}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}

/* Dialogs ---------------------------------------------------------------------- */

/**
 * On a project's tab, services are grouped by the account they run under (Plan P12.2), so "which
 * login does this project use for what" reads at a glance. Elsewhere it is one list.
 */
function groupByAccount(services: ServiceRow[], byAccount: boolean) {
  if (!byAccount) return [{ key: "all", title: null, href: null, services }]
  const groups = new Map<
    string,
    { key: string; title: string | null; href: string | null; services: ServiceRow[] }
  >()
  for (const s of services) {
    const key = s.account?.id ?? "none"
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: s.account
          ? s.account.label
            ? `${s.account.platform} (${s.account.label})`
            : s.account.platform
          : "No account",
        href: s.account ? `/accounts/${s.account.id}` : null,
        services: [],
      })
    }
    groups.get(key)!.services.push(s)
  }
  const list = [...groups.values()]
  // Accounts by name, "No account" last; a single "No account" group needs no heading.
  list.sort((a, b) =>
    a.key === "none" ? 1 : b.key === "none" ? -1 : a.title!.localeCompare(b.title!),
  )
  if (list.length === 1 && list[0]!.key === "none") list[0]!.title = null
  return list
}

function ServiceDialog({
  projectId,
  service,
  accounts,
  environments,
  onClose,
}: {
  projectId: string
  service?: ServiceRow
  accounts: Option[]
  /** New services can be linked to environments in the same step (Plan P12.1). */
  environments: EnvOption[]
  onClose: () => void
}) {
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = service
        ? await updateService({ projectId, serviceId: service.id }, prev, formData)
        : await createService(projectId, prev, formData)
      if (r.status === "success") {
        toast.success(r.message ?? "Saved")
        onClose()
      }
      return r
    },
    initialFormState,
  )
  const err = (k: string) => toFieldErrors(state.fieldErrors?.[k])
  // Fold the extras unless one is filled in or has an error (Plan P10.4).
  const hasMore =
    Boolean(
      service?.purpose || service?.dashboard_url || service?.documentation_url || service?.notes,
    ) ||
    ["purpose", "dashboard_url", "documentation_url", "notes"].some((k) =>
      Boolean(state.fieldErrors?.[k]),
    )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => dispatch(data))
          }}
        >
          <DialogHeader>
            <DialogTitle>{service ? `Edit ${service.name}` : "Add service"}</DialogTitle>
            <DialogDescription>
              Define it once for the project, then link it to each environment where it runs.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={Boolean(state.fieldErrors?.name)}>
                <FieldLabel htmlFor="svc-name">Name</FieldLabel>
                <Input
                  id="svc-name"
                  name="name"
                  defaultValue={service?.name ?? ""}
                  maxLength={120}
                  placeholder="Postgres"
                  autoFocus
                />
                <FieldError errors={err("name")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="svc-category">Category</FieldLabel>
                <Select name="category" defaultValue={service?.category ?? "database"}>
                  <SelectTrigger id="svc-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {SERVICE_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field data-invalid={Boolean(state.fieldErrors?.account_id)}>
              <FieldLabel htmlFor="svc-account">Account</FieldLabel>
              <Select name="account_id" defaultValue={service?.account_id ?? "none"}>
                <SelectTrigger id="svc-account" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Which login it runs under. Add accounts and their passwords on the{" "}
                <Link href="/accounts" className="underline underline-offset-4">
                  Accounts
                </Link>{" "}
                page.
              </FieldDescription>
              <FieldError errors={err("account_id")} />
            </Field>
            <Field data-invalid={Boolean(state.fieldErrors?.provider)}>
              <FieldLabel htmlFor="svc-provider">Provider</FieldLabel>
              <Input
                id="svc-provider"
                name="provider"
                defaultValue={service?.provider ?? ""}
                maxLength={120}
                placeholder="Supabase, Upstash, Cloudinary…"
              />
              <FieldError errors={err("provider")} />
            </Field>
            {!service && environments.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Runs in</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {environments.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="environment_ids"
                        value={e.id}
                        className="size-4 accent-primary"
                      />
                      {e.name}
                    </label>
                  ))}
                </div>
                <FieldDescription>
                  Tick every environment that uses it. Details for each, like the resource name, can
                  be added after.
                </FieldDescription>
              </fieldset>
            ) : null}
            <MoreDetails open={hasMore} hint="purpose, links, notes">
              <Field data-invalid={Boolean(state.fieldErrors?.purpose)}>
                <FieldLabel htmlFor="svc-purpose">Purpose</FieldLabel>
                <Input
                  id="svc-purpose"
                  name="purpose"
                  defaultValue={service?.purpose ?? ""}
                  maxLength={500}
                  placeholder="Primary application database"
                />
                <FieldError errors={err("purpose")} />
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field data-invalid={Boolean(state.fieldErrors?.dashboard_url)}>
                  <FieldLabel htmlFor="svc-dashboard">Dashboard URL</FieldLabel>
                  <Input
                    id="svc-dashboard"
                    name="dashboard_url"
                    type="url"
                    defaultValue={service?.dashboard_url ?? ""}
                    maxLength={2048}
                  />
                  <FieldError errors={err("dashboard_url")} />
                </Field>
                <Field data-invalid={Boolean(state.fieldErrors?.documentation_url)}>
                  <FieldLabel htmlFor="svc-docs">Documentation URL</FieldLabel>
                  <Input
                    id="svc-docs"
                    name="documentation_url"
                    type="url"
                    defaultValue={service?.documentation_url ?? ""}
                    maxLength={2048}
                  />
                  <FieldError errors={err("documentation_url")} />
                </Field>
              </div>
              <Field data-invalid={Boolean(state.fieldErrors?.notes)}>
                <FieldLabel htmlFor="svc-notes">Notes</FieldLabel>
                <Textarea
                  id="svc-notes"
                  name="notes"
                  defaultValue={service?.notes ?? ""}
                  maxLength={10000}
                  rows={3}
                />
                <FieldError errors={err("notes")} />
              </Field>
            </MoreDetails>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {service ? "Save service" : "Add service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InstanceDialog({
  projectId,
  services,
  environments,
  fixedServiceId,
  fixedEnvironmentId,
  instance,
  onClose,
}: {
  projectId: string
  services: Option[]
  environments: EnvOption[]
  fixedServiceId?: string
  fixedEnvironmentId?: string
  instance?: Instance
  onClose: () => void
}) {
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = instance
        ? await updateInstance({ projectId, instanceId: instance.id }, prev, formData)
        : await addInstance(projectId, prev, formData)
      if (r.status === "success") {
        toast.success(r.message ?? "Saved")
        onClose()
      }
      return r
    },
    initialFormState,
  )
  const err = (k: string) => toFieldErrors(state.fieldErrors?.[k])
  // Fold the extras unless one is filled in or has an error (Plan P10.4).
  const hasMore =
    Boolean(
      instance &&
      (instance.region ||
        instance.endpoint_hostname ||
        instance.version_or_plan ||
        instance.status !== "active" ||
        instance.related_variables.length ||
        instance.notes),
    ) ||
    ["region", "endpoint_hostname", "version_or_plan", "related_variables", "notes"].some((k) =>
      Boolean(state.fieldErrors?.[k]),
    )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => dispatch(data))
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {instance ? "Edit service in environment" : "Add service to environment"}
            </DialogTitle>
            <DialogDescription>
              Environment-specific details. Endpoints are hostnames or URLs without credentials.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <FieldGroup>
            {fixedServiceId ? (
              <input type="hidden" name="project_service_id" value={fixedServiceId} />
            ) : (
              <Field data-invalid={Boolean(state.fieldErrors?.project_service_id)}>
                <FieldLabel htmlFor="inst-service">Service</FieldLabel>
                <Select name="project_service_id" defaultValue={services[0]?.id}>
                  <SelectTrigger id="inst-service" className="w-full">
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={err("project_service_id")} />
              </Field>
            )}
            {fixedEnvironmentId ? (
              <input type="hidden" name="environment_id" value={fixedEnvironmentId} />
            ) : (
              <Field data-invalid={Boolean(state.fieldErrors?.environment_id)}>
                <FieldLabel htmlFor="inst-env">Environment</FieldLabel>
                <Select name="environment_id" defaultValue={environments[0]?.id}>
                  <SelectTrigger id="inst-env" className="w-full">
                    <SelectValue placeholder="Choose an environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={err("environment_id")} />
              </Field>
            )}
            <Field data-invalid={Boolean(state.fieldErrors?.resource_name)}>
              <FieldLabel htmlFor="inst-resource">Resource name</FieldLabel>
              <Input
                id="inst-resource"
                name="resource_name"
                defaultValue={instance?.resource_name ?? ""}
                maxLength={200}
                placeholder="portal-prod-db"
              />
              <FieldError errors={err("resource_name")} />
            </Field>
            <MoreDetails open={hasMore} hint="region, endpoint, status, variables">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field data-invalid={Boolean(state.fieldErrors?.region)}>
                  <FieldLabel htmlFor="inst-region">Region</FieldLabel>
                  <Input
                    id="inst-region"
                    name="region"
                    defaultValue={instance?.region ?? ""}
                    maxLength={100}
                    placeholder="ap-southeast-1"
                  />
                  <FieldError errors={err("region")} />
                </Field>
                <Field data-invalid={Boolean(state.fieldErrors?.endpoint_hostname)}>
                  <FieldLabel htmlFor="inst-endpoint">Endpoint / hostname</FieldLabel>
                  <Input
                    id="inst-endpoint"
                    name="endpoint_hostname"
                    defaultValue={instance?.endpoint_hostname ?? ""}
                    maxLength={255}
                    placeholder="db.abcd.supabase.co"
                    className="font-mono text-sm"
                  />
                  <FieldError errors={err("endpoint_hostname")} />
                </Field>
                <Field data-invalid={Boolean(state.fieldErrors?.version_or_plan)}>
                  <FieldLabel htmlFor="inst-version">Version / plan</FieldLabel>
                  <Input
                    id="inst-version"
                    name="version_or_plan"
                    defaultValue={instance?.version_or_plan ?? ""}
                    maxLength={100}
                    placeholder="Postgres 17 · Pro"
                  />
                  <FieldError errors={err("version_or_plan")} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="inst-status">Status</FieldLabel>
                <Select name="status" defaultValue={instance?.status ?? "active"}>
                  <SelectTrigger id="inst-status" className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_INSTANCE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SERVICE_INSTANCE_STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>What you last saw, not a live health check.</FieldDescription>
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.related_variables)}>
                <FieldLabel htmlFor="inst-vars">Variables it uses</FieldLabel>
                <Input
                  id="inst-vars"
                  name="related_variables"
                  defaultValue={instance?.related_variables.join(", ") ?? ""}
                  placeholder="DATABASE_URL, DIRECT_URL"
                  className="font-mono text-sm"
                />
                <FieldDescription>Variable names only.</FieldDescription>
                <FieldError errors={err("related_variables")} />
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.notes)}>
                <FieldLabel htmlFor="inst-notes">Notes</FieldLabel>
                <Textarea
                  id="inst-notes"
                  name="notes"
                  defaultValue={instance?.notes ?? ""}
                  maxLength={10000}
                  rows={2}
                />
                <FieldError errors={err("notes")} />
              </Field>
            </MoreDetails>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {instance ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
