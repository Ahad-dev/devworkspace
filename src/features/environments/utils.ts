import type {
  ConfigurationStatus,
  EnvironmentStatus,
  EnvironmentType,
  VerificationMethod,
} from "@/lib/constants/domain"

/** Pure environment helpers shared by forms, pages and tests (Spec FR-08; Plan P5.4–P5.7). */

export const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/

/**
 * Turn what was typed or pasted into a variable name. `NAME=value` keeps only the name and reports
 * that a value was dropped (Plan P5.6); `export NAME=…` is tolerated. The value never leaves here.
 */
export function parseVariableName(input: string): { name: string; droppedValue: boolean } {
  let text = input.trim()
  text = text.replace(/^export\s+/, "")
  const eq = text.indexOf("=")
  const droppedValue = eq >= 0
  const name = (droppedValue ? text.slice(0, eq) : text).trim()
  return { name, droppedValue }
}

/**
 * Names-only bulk add (Plan P5.6): one variable per line, .env style. Values, comments and blank
 * lines are discarded; invalid names are reported back, duplicates kept once.
 */
export function parseBulkNames(text: string) {
  const names: string[] = []
  const invalid: string[] = []
  let droppedValues = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const { name, droppedValue } = parseVariableName(line)
    if (droppedValue) droppedValues++
    if (!VARIABLE_NAME.test(name)) {
      // Report only the part before "=", never a value.
      invalid.push(name.slice(0, 60) || "(empty)")
      continue
    }
    if (!names.includes(name)) names.push(name)
  }
  return { names, invalid, droppedValues }
}

/** "node 24.11, pnpm 10.33" or "node=24.11\npnpm=10" → { node: "24.11", pnpm: "10.33" }. */
export function parseRuntimeVersions(text: string): {
  value: Record<string, string>
  error: string | null
} {
  const value: Record<string, string> = {}
  const parts = text
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const part of parts) {
    const m = /^([A-Za-z][\w .+-]{0,49}?)\s*(?:[=:@]|\s)\s*([\w.+-]{1,50})$/.exec(part)
    if (!m) return { value: {}, error: `Couldn't read "${part.slice(0, 40)}". Use "node 24.11".` }
    value[m[1]!.trim()] = m[2]!
  }
  if (Object.keys(value).length > 30) return { value: {}, error: "Use at most 30 runtimes" }
  return { value, error: null }
}

export function formatRuntimeVersions(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ""
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `${k} ${v as string}`)
    .join(", ")
}

/** Plan P5.4: status needs_review, or not reviewed within 90 days. */
export const REVIEW_AFTER_DAYS = 90

export function needsReview(
  env: { status: EnvironmentStatus; last_reviewed_at: string | null },
  now: number = Date.now(),
) {
  if (env.status === "archived") return false
  if (env.status === "needs_review") return true
  if (!env.last_reviewed_at) return true
  return now - Date.parse(env.last_reviewed_at) > REVIEW_AFTER_DAYS * 24 * 60 * 60 * 1000
}

/** Order environments the way people think about them: local → dev → staging → prod → custom. */
const TYPE_ORDER: Record<EnvironmentType, number> = {
  local: 0,
  development: 1,
  staging: 2,
  production: 3,
  custom: 4,
}
export function compareEnvironments(
  a: { environment_type: EnvironmentType; name: string },
  b: { environment_type: EnvironmentType; name: string },
) {
  return (
    TYPE_ORDER[a.environment_type] - TYPE_ORDER[b.environment_type] || a.name.localeCompare(b.name)
  )
}

/* Comparison (Plan P5.7) ------------------------------------------------------- */

export type ComparisonVariable = {
  environment_id: string
  name: string
  is_required: boolean
  is_sensitive: boolean
  configuration_status: ConfigurationStatus
  verification_method: VerificationMethod
  last_verified_at: string | null
  secret_reference_id: string | null
  account_secret_id: string | null
}

export type ComparisonCell =
  | { present: false }
  | {
      present: true
      required: boolean
      status: ConfigurationStatus
      method: VerificationMethod
      verifiedAt: string | null
      hasReference: boolean
      inVault: boolean
    }

export type ComparisonRow = {
  name: string
  /** Sensitive in any environment. */
  sensitive: boolean
  cells: Record<string, ComparisonCell>
  /** Needs attention: required somewhere and missing/unknown or absent in a compared environment. */
  attention: boolean
}

/**
 * Variable-name matrix across environments. Values are never involved: the inputs have no value
 * field at all. A variable required in one environment and absent from another is flagged.
 */
export function buildComparison(
  environmentIds: string[],
  variables: ComparisonVariable[],
): ComparisonRow[] {
  const byName = new Map<string, ComparisonRow>()
  for (const v of variables) {
    if (!environmentIds.includes(v.environment_id)) continue
    const row =
      byName.get(v.name) ??
      ({
        name: v.name,
        sensitive: false,
        cells: Object.fromEntries(environmentIds.map((id) => [id, { present: false }])),
        attention: false,
      } as ComparisonRow)
    row.sensitive ||= v.is_sensitive
    row.cells[v.environment_id] = {
      present: true,
      required: v.is_required,
      status: v.configuration_status,
      method: v.verification_method,
      verifiedAt: v.last_verified_at,
      hasReference: v.secret_reference_id !== null,
      inVault: v.account_secret_id !== null,
    }
    byName.set(v.name, row)
  }

  for (const row of byName.values()) {
    const cells = Object.values(row.cells)
    const requiredSomewhere = cells.some((c) => c.present && c.required)
    row.attention = cells.some(
      (c) =>
        (!c.present && requiredSomewhere) ||
        (c.present && c.required && (c.status === "missing" || c.status === "unknown")),
    )
  }

  return [...byName.values()].sort(
    (a, b) => Number(b.attention) - Number(a.attention) || a.name.localeCompare(b.name),
  )
}
