import "server-only"

import { cache } from "react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireUser } from "@/lib/auth/session"
import {
  ENVIRONMENT_TYPES,
  SERVICE_CATEGORIES,
  type EnvironmentType,
  type ServiceCategory,
} from "@/lib/constants/domain"
import { createClient } from "@/lib/supabase/server"
import {
  ENVIRONMENT_DETAIL_SELECT,
  ENVIRONMENT_INSTANCES_SELECT,
  ENVIRONMENT_LIST_SELECT,
  SERVICE_LIST_SELECT,
} from "./selects"
import { compareEnvironments } from "./utils"

/**
 * Environment, service and configuration reads (Spec FR-08, FR-09; Plan P5.4–P5.8). All run as
 * the signed-in user under RLS. None of these tables has a value column, so nothing here can
 * return a secret.
 */

const isUuid = (v: string) => z.uuid().safeParse(v).success
const countOf = (rel: { count: number }[] | null | undefined) => rel?.[0]?.count ?? 0

/* Environments ----------------------------------------------------------------- */

export type EnvironmentListFilters = {
  q: string
  type: EnvironmentType | null
  view: "active" | "archived" | "review"
}

export function parseEnvironmentFilters(
  sp: Record<string, string | string[] | undefined>,
): EnvironmentListFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k])?.toString() ?? ""
  const type = one("type")
  const view = one("view")
  return {
    q: one("q").trim().slice(0, 100),
    type: (ENVIRONMENT_TYPES as readonly string[]).includes(type)
      ? (type as EnvironmentType)
      : null,
    view: view === "archived" || view === "review" ? view : "active",
  }
}

export async function listEnvironments(
  filters: EnvironmentListFilters,
  scope: { projectId?: string } = {},
) {
  await requireUser()
  const supabase = await createClient()
  let q = supabase.from("environments").select(ENVIRONMENT_LIST_SELECT).limit(300)
  if (scope.projectId) q = q.eq("project_id", scope.projectId)
  q = filters.view === "archived" ? q.eq("status", "archived") : q.neq("status", "archived")
  if (filters.type) q = q.eq("environment_type", filters.type)
  if (filters.q) {
    const term = filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)
    q = q.ilike("name", `%${term}%`)
  }
  const { data, error } = await q.order("name")
  if (error) throw new Error("Couldn't load environments")
  return (data ?? [])
    .map((e) => ({
      ...e,
      variableCount: countOf(e.environment_variables),
      instanceCount: countOf(e.service_instances),
    }))
    .sort(
      (a, b) =>
        (a.project?.name ?? "").localeCompare(b.project?.name ?? "") || compareEnvironments(a, b),
    )
}

export type EnvironmentListRow = Awaited<ReturnType<typeof listEnvironments>>[number]

export const getEnvironment = cache(async (environmentId: string) => {
  await requireUser()
  if (!isUuid(environmentId)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("environments")
    .select(ENVIRONMENT_DETAIL_SELECT)
    .eq("id", environmentId)
    .maybeSingle()
  if (error) throw new Error("Couldn't load the environment")
  if (!data || !data.project) notFound()
  return { ...data, project: data.project }
})

export type EnvironmentDetail = Awaited<ReturnType<typeof getEnvironment>>

/** Other environments of the same project, for the compare picker and navigation. */
export async function listSiblingEnvironments(projectId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("environments")
    .select("id, name, environment_type, status")
    .eq("project_id", projectId)
    .neq("status", "archived")
  return (data ?? []).sort(compareEnvironments)
}

/* Variables and secret references ------------------------------------------- */

export async function listEnvironmentVariables(environmentId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("environment_variables")
    .select(
      "id, name, is_required, is_sensitive, configuration_status, verification_method, last_verified_at, notes, secret_reference_id",
    )
    .eq("environment_id", environmentId)
    .order("name")
  if (error) throw new Error("Couldn't load variables")
  return data ?? []
}

export type EnvironmentVariableRow = Awaited<ReturnType<typeof listEnvironmentVariables>>[number]

export async function listSecretReferences() {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("secret_references")
    .select("id, provider, vault_project_or_workspace, vault_path_or_item_id, key_name, vault_url")
    .order("provider")
    .order("key_name")
  if (error) throw new Error("Couldn't load secret references")
  return data ?? []
}

export type SecretReferenceRow = Awaited<ReturnType<typeof listSecretReferences>>[number]

/** Comparison data (Plan P5.7): variable metadata for the chosen environments of one project. */
export async function getComparisonData(projectId: string, environmentIds: string[]) {
  await requireUser()
  const supabase = await createClient()
  const ids = environmentIds.filter(isUuid).slice(0, 6)
  const [environments, variables] = await Promise.all([
    supabase
      .from("environments")
      .select("id, name, environment_type, status")
      .eq("project_id", projectId)
      .neq("status", "archived"),
    ids.length
      ? supabase
          .from("environment_variables")
          .select(
            "environment_id, name, is_required, is_sensitive, configuration_status, verification_method, last_verified_at, secret_reference_id",
          )
          .eq("project_id", projectId)
          .in("environment_id", ids)
      : Promise.resolve({ data: [] }),
  ])
  return {
    environments: (environments.data ?? []).sort(compareEnvironments),
    variables: variables.data ?? [],
  }
}

/* Services --------------------------------------------------------------------- */

export async function listEnvironmentInstances(environmentId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("service_instances")
    .select(ENVIRONMENT_INSTANCES_SELECT)
    .eq("environment_id", environmentId)
  if (error) throw new Error("Couldn't load services")
  return (data ?? []).sort((a, b) => (a.service?.name ?? "").localeCompare(b.service?.name ?? ""))
}

export type ServiceFilters = { q: string; category: ServiceCategory | null }

export function parseServiceFilters(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k])?.toString() ?? ""
  const category = one("category")
  return {
    q: one("q").trim().slice(0, 100),
    category: (SERVICE_CATEGORIES as readonly string[]).includes(category)
      ? (category as ServiceCategory)
      : null,
  }
}

/** Services with their per-environment instances; across projects unless scoped (Spec FR-09). */
export async function listServices(filters: ServiceFilters, scope: { projectId?: string } = {}) {
  await requireUser()
  const supabase = await createClient()
  let q = supabase.from("project_services").select(SERVICE_LIST_SELECT).limit(300)
  if (scope.projectId) q = q.eq("project_id", scope.projectId)
  if (filters.category) q = q.eq("category", filters.category)
  if (filters.q) {
    const term = filters.q.replace(/[\\%_,()]/g, (c) => `\\${c}`)
    q = q.or(`name.ilike.%${term}%,provider.ilike.%${term}%,purpose.ilike.%${term}%`)
  }
  const { data, error } = await q.order("name")
  if (error) throw new Error("Couldn't load services")
  return (data ?? []).map((s) => ({
    ...s,
    instances: [...(s.instances ?? [])]
      .filter((i) => i.environment !== null)
      .sort((x, y) => compareEnvironments(x.environment!, y.environment!)),
  }))
}

export type ServiceRow = Awaited<ReturnType<typeof listServices>>[number]

/** How many variables point at each secret reference. */
export async function getSecretReferenceUsage(): Promise<Record<string, number>> {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("environment_variables")
    .select("secret_reference_id")
    .not("secret_reference_id", "is", null)
    .limit(5000)
  const usage: Record<string, number> = {}
  for (const row of data ?? []) {
    if (row.secret_reference_id)
      usage[row.secret_reference_id] = (usage[row.secret_reference_id] ?? 0) + 1
  }
  return usage
}

/** A project's service definitions, for pickers. */
export async function listServiceOptions(projectId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("project_services")
    .select("id, name")
    .eq("project_id", projectId)
    .order("name")
  return data ?? []
}
