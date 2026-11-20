"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { FormState } from "@/features/projects/schemas"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  environmentCreateSchema,
  environmentUpdateSchema,
  instanceSchema,
  secretReferenceSchema,
  serviceSchema,
  variableSchema,
} from "./schemas"
import { parseBulkNames, parseVariableName } from "./utils"

/**
 * Environment, service and configuration-metadata actions (Spec FR-08, FR-09; Plan P5.4–P5.8).
 * Each validates input, requires a signed-in user and writes as that user, so RLS, composite FKs,
 * the no-secret domain and the verification trigger stay the final authority. No action accepts a
 * secret value: forms have no value field, and pasted NAME=value keeps only the name.
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

const uuid = z.uuid()
const isUuid = (v: unknown): v is string => uuid.safeParse(v).success
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "")
const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true"

function fieldErrors(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: z.flattenError(error).fieldErrors }
}

function dbError(error: { code?: string; hint?: string } | null, nameTaken: string): FormState {
  switch (error?.code) {
    case "23505":
      return { status: "error", fieldErrors: { name: [nameTaken] } }
    case "23514":
      return {
        status: "error",
        message:
          "Something here isn't allowed: check URLs and hostnames (no credentials) and remove anything that looks like a key, token or password.",
      }
    case "23503":
      return {
        status: "error",
        message:
          "The project, environment, service or reference doesn't match. Refresh and try again.",
      }
    case "42501":
      return {
        status: "error",
        message:
          error.hint === "integration_reserved"
            ? "Only a server integration can mark a variable as integration verified."
            : "You don't have access to change that.",
      }
    default:
      return { status: "error", message: "Couldn't save. Try again." }
  }
}

function revalidate(projectId?: string | null, environmentId?: string) {
  revalidatePath("/environments", "layout")
  revalidatePath("/services")
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout")
  if (environmentId) revalidatePath(`/environments/${environmentId}`, "layout")
}

async function environmentProject(environmentId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("environments")
    .select("project_id, name, environment_type, status")
    .eq("id", environmentId)
    .maybeSingle()
  return data
}

/* Environments ----------------------------------------------------------------- */

/** Quick-create (Plan P7.3): the project is picked on the form instead of bound by the page. */
export async function createEnvironmentFromForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = text(formData, "project_id")
  if (!isUuid(projectId))
    return { status: "error", fieldErrors: { project_id: ["Choose a project"] } }
  return createEnvironment(projectId, _prev, formData)
}

export async function createEnvironment(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(projectId)) return { status: "error", message: "Unknown project." }
  const parsed = environmentCreateSchema.safeParse({
    name: text(formData, "name"),
    environment_type: text(formData, "environment_type"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("environments")
    .insert({ ...parsed.data, project_id: projectId })
    .select("id")
    .single()
  if (error || !data)
    return dbError(error, "This project already has an environment with that name")

  revalidate(projectId)
  redirect(`/environments/${data.id}`)
}

export async function updateEnvironment(
  environmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(environmentId)) return { status: "error", message: "Unknown environment." }
  const parsed = environmentUpdateSchema.safeParse({
    name: text(formData, "name"),
    environment_type: text(formData, "environment_type"),
    status: formData.has("status") ? text(formData, "status") : undefined,
    machine_label: text(formData, "machine_label"),
    application_url: text(formData, "application_url"),
    api_url: text(formData, "api_url"),
    deployment_provider: text(formData, "deployment_provider"),
    server_hostname: text(formData, "server_hostname"),
    operating_system: text(formData, "operating_system"),
    runtime_versions: text(formData, "runtime_versions"),
    deployment_branch: text(formData, "deployment_branch"),
    deployment_method: text(formData, "deployment_method"),
    notes: text(formData, "notes"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("environments")
    .update(parsed.data)
    .eq("id", environmentId)
    .select("project_id")
  if (error) return dbError(error, "This project already has an environment with that name")
  if (!data?.length) return { status: "error", message: "Environment not found." }

  revalidate(data[0]?.project_id, environmentId)
  redirect(`/environments/${environmentId}`)
}

export async function setEnvironmentArchived(
  environmentId: string,
  archived: boolean,
): Promise<ActionResult> {
  if (!isUuid(environmentId)) return { ok: false, error: "Unknown environment." }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("environments")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", environmentId)
    .select("project_id")
  if (error || !data?.length) return { ok: false, error: "Couldn't update the environment." }
  revalidate(data[0]?.project_id, environmentId)
  return { ok: true }
}

/** "Mark reviewed" (Spec §5.6): the database stamps the server time; clears Needs review. */
export async function markEnvironmentReviewed(environmentId: string): Promise<ActionResult> {
  if (!isUuid(environmentId)) return { ok: false, error: "Unknown environment." }
  await requireUser()
  const env = await environmentProject(environmentId)
  if (!env) return { ok: false, error: "Environment not found." }
  const supabase = await createClient()
  const { error } = await supabase
    .from("environments")
    .update({
      last_reviewed_at: new Date().toISOString(),
      ...(env.status === "needs_review" ? { status: "active" as const } : {}),
    })
    .eq("id", environmentId)
  if (error) return { ok: false, error: "Couldn't mark it reviewed." }
  revalidate(env.project_id, environmentId)
  return { ok: true }
}

/**
 * Delete (Spec FR-08: confirm first). A production environment needs its name typed; the server
 * checks it too. Used as a form action via useActionState(deleteEnvironment.bind(null, id)).
 */
export async function deleteEnvironment(
  environmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(environmentId)) return { status: "error", message: "Unknown environment." }
  await requireUser()
  const env = await environmentProject(environmentId)
  if (!env) return { status: "error", message: "Environment not found." }
  if (env.environment_type === "production" && text(formData, "confirm_name").trim() !== env.name) {
    return {
      status: "error",
      fieldErrors: { confirm_name: [`Type ${env.name} to delete this production environment`] },
    }
  }
  const supabase = await createClient()
  const { error } = await supabase.from("environments").delete().eq("id", environmentId)
  if (error) return { status: "error", message: "Couldn't delete the environment. Try again." }
  revalidate(env.project_id)
  redirect(`/projects/${env.project_id}/environments`)
}

/* Variables -------------------------------------------------------------------- */

function readVariable(formData: FormData) {
  return {
    name: text(formData, "name"),
    is_required: bool(formData, "is_required"),
    is_sensitive: bool(formData, "is_sensitive"),
    configuration_status: text(formData, "configuration_status") || "unknown",
    verification_method: text(formData, "verification_method") || "manual",
    notes: text(formData, "notes"),
    secret_reference_id: text(formData, "secret_reference_id"),
  }
}

export async function addVariable(
  environmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(environmentId)) return { status: "error", message: "Unknown environment." }
  const raw = readVariable(formData)
  const parsed = variableSchema.safeParse(raw)
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const env = await environmentProject(environmentId)
  if (!env) return { status: "error", message: "Environment not found." }
  const supabase = await createClient()
  const { error } = await supabase
    .from("environment_variables")
    .insert({ ...parsed.data, project_id: env.project_id, environment_id: environmentId })
  if (error) return dbError(error, "This environment already has that variable")

  revalidate(env.project_id, environmentId)
  return {
    status: "success",
    message: parseVariableName(raw.name).droppedValue
      ? `Added ${parsed.data.name}. The value after "=" was discarded: DevWorkspace stores names only.`
      : `Added ${parsed.data.name}.`,
  }
}

export async function updateVariable(
  ids: { environmentId: string; variableId: string },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(ids.environmentId) || !isUuid(ids.variableId)) {
    return { status: "error", message: "Unknown variable." }
  }
  const parsed = variableSchema.safeParse(readVariable(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("environment_variables")
    .update(parsed.data)
    .eq("id", ids.variableId)
    .select("project_id")
  if (error) return dbError(error, "This environment already has that variable")
  if (!data?.length) return { status: "error", message: "Variable not found." }

  revalidate(data[0]?.project_id, ids.environmentId)
  return { status: "success", message: `Saved ${parsed.data.name}.` }
}

/** Quick status change from the table: always a manual assertion (Spec FR-08 honesty). */
export async function setVariableStatus(input: {
  environmentId: string
  variableId: string
  status: string
}): Promise<ActionResult> {
  const status = variableSchema.shape.configuration_status.safeParse(input.status)
  if (!isUuid(input.environmentId) || !isUuid(input.variableId) || !status.success) {
    return { ok: false, error: "Invalid status." }
  }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("environment_variables")
    .update({ configuration_status: status.data, verification_method: "manual" })
    .eq("id", input.variableId)
    .select("project_id")
  if (error || !data?.length) return { ok: false, error: "Couldn't change the status." }
  revalidate(data[0]?.project_id, input.environmentId)
  return { ok: true }
}

export async function deleteVariable(ids: {
  environmentId: string
  variableId: string
}): Promise<ActionResult> {
  if (!isUuid(ids.environmentId) || !isUuid(ids.variableId)) {
    return { ok: false, error: "Unknown variable." }
  }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("environment_variables")
    .delete()
    .eq("id", ids.variableId)
    .select("project_id")
  if (error) return { ok: false, error: "Couldn't remove the variable." }
  revalidate(data?.[0]?.project_id, ids.environmentId)
  return { ok: true }
}

/**
 * Names-only bulk add (Plan P5.6). Values are discarded on the client before submit and again
 * here; existing names are skipped.
 */
export async function bulkAddVariables(
  environmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(environmentId)) return { status: "error", message: "Unknown environment." }
  const { names, invalid } = parseBulkNames(text(formData, "names"))
  if (invalid.length) {
    return {
      status: "error",
      fieldErrors: { names: [`Not valid variable names: ${invalid.slice(0, 5).join(", ")}`] },
    }
  }
  if (names.length === 0)
    return { status: "error", fieldErrors: { names: ["Add at least one name"] } }
  if (names.length > 200)
    return { status: "error", fieldErrors: { names: ["Add at most 200 at a time"] } }

  await requireUser()
  const env = await environmentProject(environmentId)
  if (!env) return { status: "error", message: "Environment not found." }
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("environment_variables")
    .select("name")
    .eq("environment_id", environmentId)
  const have = new Set((existing ?? []).map((v) => v.name))
  const fresh = names.filter((n) => !have.has(n))
  if (fresh.length) {
    const sensitive = bool(formData, "is_sensitive")
    const { error } = await supabase.from("environment_variables").insert(
      fresh.map((name) => ({
        project_id: env.project_id,
        environment_id: environmentId,
        name,
        is_required: true,
        is_sensitive: sensitive,
      })),
    )
    if (error) return dbError(error, "One of these names already exists")
  }

  revalidate(env.project_id, environmentId)
  const skipped = names.length - fresh.length
  return {
    status: "success",
    message: `Added ${fresh.length} variable${fresh.length === 1 ? "" : "s"}${
      skipped ? `; ${skipped} already existed` : ""
    }.`,
  }
}

/* Secret references ------------------------------------------------------------ */

function readSecretReference(formData: FormData) {
  return {
    provider: text(formData, "provider"),
    vault_project_or_workspace: text(formData, "vault_project_or_workspace"),
    vault_path_or_item_id: text(formData, "vault_path_or_item_id"),
    key_name: text(formData, "key_name"),
    vault_url: text(formData, "vault_url"),
  }
}

export async function createSecretReference(
  _prev: FormState,
  formData: FormData,
): Promise<FormState<{ id: string }>> {
  const parsed = secretReferenceSchema.safeParse(readSecretReference(formData))
  if (!parsed.success) return fieldErrors(parsed.error) as FormState<{ id: string }>

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("secret_references")
    .insert(parsed.data)
    .select("id")
    .single()
  if (error || !data) return dbError(error, "") as FormState<{ id: string }>

  revalidatePath("/environments", "layout")
  return { status: "success", message: "Secret reference added.", data: { id: data.id } }
}

export async function updateSecretReference(
  referenceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(referenceId)) return { status: "error", message: "Unknown reference." }
  const parsed = secretReferenceSchema.safeParse(readSecretReference(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("secret_references")
    .update(parsed.data)
    .eq("id", referenceId)
    .select("id")
  if (error) return dbError(error, "")
  if (!data?.length) return { status: "error", message: "Reference not found." }
  revalidatePath("/environments", "layout")
  return { status: "success", message: "Secret reference saved." }
}

export async function deleteSecretReference(referenceId: string): Promise<ActionResult> {
  if (!isUuid(referenceId)) return { ok: false, error: "Unknown reference." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("secret_references").delete().eq("id", referenceId)
  if (error) return { ok: false, error: "Couldn't remove the reference." }
  revalidatePath("/environments", "layout")
  return { ok: true }
}

/* Services --------------------------------------------------------------------- */

function readService(formData: FormData) {
  return {
    name: text(formData, "name"),
    category: text(formData, "category"),
    provider: text(formData, "provider"),
    purpose: text(formData, "purpose"),
    dashboard_url: text(formData, "dashboard_url"),
    documentation_url: text(formData, "documentation_url"),
    notes: text(formData, "notes"),
  }
}

export async function createService(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(projectId)) return { status: "error", message: "Unknown project." }
  const parsed = serviceSchema.safeParse(readService(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("project_services")
    .insert({ ...parsed.data, project_id: projectId })
  if (error) return dbError(error, "This project already has a service with that name")
  revalidate(projectId)
  return { status: "success", message: `Added ${parsed.data.name}.` }
}

export async function updateService(
  ids: { projectId: string; serviceId: string },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(ids.projectId) || !isUuid(ids.serviceId)) {
    return { status: "error", message: "Unknown service." }
  }
  const parsed = serviceSchema.safeParse(readService(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_services")
    .update(parsed.data)
    .eq("id", ids.serviceId)
    .select("id")
  if (error) return dbError(error, "This project already has a service with that name")
  if (!data?.length) return { status: "error", message: "Service not found." }
  revalidate(ids.projectId)
  return { status: "success", message: `Saved ${parsed.data.name}.` }
}

export async function deleteService(ids: {
  projectId: string
  serviceId: string
}): Promise<ActionResult> {
  if (!isUuid(ids.projectId) || !isUuid(ids.serviceId))
    return { ok: false, error: "Unknown service." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("project_services").delete().eq("id", ids.serviceId)
  if (error) return { ok: false, error: "Couldn't remove the service." }
  revalidate(ids.projectId)
  return { ok: true }
}

function readInstance(formData: FormData) {
  return {
    project_service_id: text(formData, "project_service_id"),
    environment_id: text(formData, "environment_id"),
    resource_name: text(formData, "resource_name"),
    region: text(formData, "region"),
    endpoint_hostname: text(formData, "endpoint_hostname"),
    version_or_plan: text(formData, "version_or_plan"),
    status: text(formData, "status") || "unknown",
    related_variables: text(formData, "related_variables"),
    notes: text(formData, "notes"),
  }
}

export async function addInstance(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(projectId)) return { status: "error", message: "Unknown project." }
  const parsed = instanceSchema.safeParse(readInstance(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("service_instances")
    .insert({ ...parsed.data, project_id: projectId })
  if (error?.code === "23505") {
    return {
      status: "error",
      fieldErrors: { environment_id: ["This service is already in that environment"] },
    }
  }
  if (error) return dbError(error, "")
  revalidate(projectId, parsed.data.environment_id)
  return { status: "success", message: "Added to the environment." }
}

export async function updateInstance(
  ids: { projectId: string; instanceId: string },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(ids.projectId) || !isUuid(ids.instanceId)) {
    return { status: "error", message: "Unknown instance." }
  }
  const parsed = instanceSchema.safeParse(readInstance(formData))
  if (!parsed.success) return fieldErrors(parsed.error)
  // Service and environment are fixed once linked; the rest is editable.
  const { project_service_id: _s, environment_id: envId, ...fields } = parsed.data
  void _s

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("service_instances")
    .update(fields)
    .eq("id", ids.instanceId)
    .select("id")
  if (error) return dbError(error, "")
  if (!data?.length) return { status: "error", message: "Instance not found." }
  revalidate(ids.projectId, envId)
  return { status: "success", message: "Saved." }
}

export async function removeInstance(ids: {
  projectId: string
  instanceId: string
}): Promise<ActionResult> {
  if (!isUuid(ids.projectId) || !isUuid(ids.instanceId)) {
    return { ok: false, error: "Unknown instance." }
  }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("service_instances").delete().eq("id", ids.instanceId)
  if (error) return { ok: false, error: "Couldn't remove it." }
  revalidate(ids.projectId)
  return { ok: true }
}
