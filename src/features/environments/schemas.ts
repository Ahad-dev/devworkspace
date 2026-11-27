import { z } from "zod"

import { optionalText, optionalUrl } from "@/features/projects/schemas"
import {
  CONFIGURATION_STATUSES,
  EDITABLE_ENVIRONMENT_STATUSES,
  ENVIRONMENT_TYPES,
  SERVICE_CATEGORIES,
  SERVICE_INSTANCE_STATUSES,
} from "@/lib/constants/domain"
import { secretMessage } from "@/lib/security/secret-guard"
import { parseRuntimeVersions, parseVariableName, VARIABLE_NAME } from "./utils"

/**
 * Environment, service and configuration-metadata schemas (Spec FR-08, FR-09, §9.3). The
 * database repeats these rules (domains, checks, FKs); these give field-level feedback first.
 * Nothing here accepts a secret value: there is no value field anywhere.
 */

function requiredText(max: number, empty: string) {
  return z
    .string()
    .trim()
    .min(1, empty)
    .max(max, `Use at most ${max} characters`)
    .superRefine((v, ctx) => {
      const msg = secretMessage(v)
      if (msg) ctx.addIssue({ code: "custom", message: msg })
    })
}

const optionalUuid = z
  .union([z.uuid(), z.literal(""), z.literal("none")])
  .transform((v) => (v === "" || v === "none" ? null : v))

const branch = z
  .string()
  .trim()
  .max(255, "Use at most 255 characters")
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || !/\s/.test(v), "Branch names can't contain spaces")

/* Environments ----------------------------------------------------------------- */

export const environmentCreateSchema = z.object({
  name: requiredText(100, "Enter a name"),
  environment_type: z.enum(ENVIRONMENT_TYPES, "Choose a type"),
})

export const environmentUpdateSchema = z.object({
  name: requiredText(100, "Enter a name"),
  environment_type: z.enum(ENVIRONMENT_TYPES, "Choose a type"),
  // Omitted for archived environments: archive/restore are separate actions.
  status: z.enum(EDITABLE_ENVIRONMENT_STATUSES, "Choose a status").optional(),
  machine_label: optionalText(100),
  application_url: optionalUrl,
  api_url: optionalUrl,
  deployment_provider: optionalText(100),
  server_hostname: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine(
      (v) => v === null || /^[A-Za-z0-9._:[\]-]{1,255}$/.test(v),
      "Use a hostname or IP, with an optional port (no user@, scheme or path)",
    ),
  operating_system: optionalText(100),
  runtime_versions: z.string().transform((v, ctx) => {
    const parsed = parseRuntimeVersions(v)
    if (parsed.error) {
      ctx.addIssue({ code: "custom", message: parsed.error })
      return z.NEVER
    }
    return parsed.value
  }),
  deployment_branch: branch,
  deployment_method: optionalText(2000),
  notes: optionalText(20000),
})

export type EnvironmentUpdateInput = z.infer<typeof environmentUpdateSchema>

/* Variables -------------------------------------------------------------------- */

export const variableNameSchema = z
  .string()
  .transform((v) => parseVariableName(v).name)
  .refine((v) => v.length > 0, "Enter a variable name")
  .refine(
    (v) => VARIABLE_NAME.test(v),
    "Use letters, digits and underscores, starting with a letter or underscore (e.g. DATABASE_URL)",
  )

export const variableSchema = z
  .object({
    name: variableNameSchema,
    is_required: z.boolean(),
    is_sensitive: z.boolean(),
    configuration_status: z.enum(CONFIGURATION_STATUSES, "Choose a status"),
    // "integration" is reserved for a server-side integration (the database refuses it too).
    verification_method: z.enum(["manual", "imported"], "Choose how this was established"),
    notes: optionalText(2000),
    secret_reference_id: optionalUuid,
    // "In my vault" (Plan P12.3): the account secret that holds the value. One place or the other.
    account_secret_id: optionalUuid,
  })
  .refine((v) => !(v.secret_reference_id && v.account_secret_id), {
    path: ["account_secret_id"],
    message: "Pick one place where the value is stored",
  })

export type VariableInput = z.infer<typeof variableSchema>

/* Secret references ------------------------------------------------------------ */

export const secretReferenceSchema = z.object({
  provider: requiredText(60, "Choose or enter a provider"),
  vault_project_or_workspace: optionalText(200),
  vault_path_or_item_id: requiredText(500, "Enter the vault path or item id"),
  key_name: optionalText(200),
  vault_url: optionalUrl,
})

export type SecretReferenceInput = z.infer<typeof secretReferenceSchema>

/* Services --------------------------------------------------------------------- */

export const serviceSchema = z.object({
  name: requiredText(120, "Enter a name"),
  category: z.enum(SERVICE_CATEGORIES, "Choose a category"),
  provider: optionalText(120),
  purpose: optionalText(500),
  dashboard_url: optionalUrl,
  documentation_url: optionalUrl,
  notes: optionalText(10000),
  // The account it runs under (Plan P11.4); "none" or empty clears it.
  account_id: z
    .string()
    .transform((v) => (v === "" || v === "none" ? null : v))
    .pipe(z.uuid("Choose an account").nullable()),
})

export type ServiceInput = z.infer<typeof serviceSchema>

export const instanceSchema = z.object({
  project_service_id: z.uuid("Choose a service"),
  environment_id: z.uuid("Choose an environment"),
  resource_name: optionalText(200),
  region: optionalText(100),
  endpoint_hostname: optionalText(255).refine(
    (v) => v === null || !/[\s@]/.test(v),
    "Use a hostname or URL without credentials (no user@ or spaces)",
  ),
  version_or_plan: optionalText(100),
  status: z.enum(SERVICE_INSTANCE_STATUSES, "Choose a status"),
  related_variables: z.string().transform((v, ctx) => {
    const names = [
      ...new Set(
        v
          .split(/[\s,]+/)
          .map((n) => parseVariableName(n).name)
          .filter(Boolean),
      ),
    ]
    const bad = names.find((n) => !VARIABLE_NAME.test(n))
    if (bad) {
      ctx.addIssue({ code: "custom", message: `"${bad.slice(0, 40)}" isn't a variable name` })
      return z.NEVER
    }
    if (names.length > 20) {
      ctx.addIssue({ code: "custom", message: "List at most 20 variables" })
      return z.NEVER
    }
    return names
  }),
  notes: optionalText(10000),
})

export type InstanceInput = z.infer<typeof instanceSchema>
