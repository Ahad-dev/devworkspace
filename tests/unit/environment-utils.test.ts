import { describe, expect, it } from "vitest"

import {
  environmentUpdateSchema,
  instanceSchema,
  secretReferenceSchema,
  variableSchema,
} from "@/features/environments/schemas"
import {
  buildComparison,
  formatRuntimeVersions,
  needsReview,
  parseBulkNames,
  parseRuntimeVersions,
  parseVariableName,
  type ComparisonVariable,
} from "@/features/environments/utils"

describe("parseVariableName", () => {
  it("keeps the name and drops a pasted value", () => {
    expect(parseVariableName("DATABASE_URL=postgres://u:p@h/db")).toEqual({
      name: "DATABASE_URL",
      droppedValue: true,
    })
    expect(parseVariableName("  export API_KEY = sk_live_abc  ")).toEqual({
      name: "API_KEY",
      droppedValue: true,
    })
    expect(parseVariableName("REDIS_URL")).toEqual({ name: "REDIS_URL", droppedValue: false })
  })
})

describe("parseBulkNames", () => {
  it("reads a .env paste as names only", () => {
    const r = parseBulkNames(
      [
        "# comment",
        "DATABASE_URL=postgres://user:secret@db:5432/app",
        "",
        "REDIS_URL=rediss://default:token@cache:6379",
        "NEXT_PUBLIC_SITE_URL",
        "DATABASE_URL=dup",
        "bad name=x",
      ].join("\n"),
    )
    expect(r.names).toEqual(["DATABASE_URL", "REDIS_URL", "NEXT_PUBLIC_SITE_URL"])
    expect(r.droppedValues).toBe(4)
    expect(r.invalid).toEqual(["bad name"])
    // No value survives anywhere in the result.
    expect(JSON.stringify(r)).not.toMatch(/secret|token|postgres/)
  })
})

describe("runtime versions", () => {
  it("parses and formats name/version pairs", () => {
    expect(parseRuntimeVersions("node 24.11, pnpm=10.33\npython: 3.13")).toEqual({
      value: { node: "24.11", pnpm: "10.33", python: "3.13" },
      error: null,
    })
    expect(parseRuntimeVersions("").value).toEqual({})
    expect(parseRuntimeVersions("node").error).toMatch(/Couldn't read/)
    expect(formatRuntimeVersions({ node: "24.11", pnpm: "10.33" })).toBe("node 24.11, pnpm 10.33")
    expect(formatRuntimeVersions(["x"])).toBe("")
  })
})

describe("needsReview", () => {
  const now = Date.parse("2026-06-01T00:00:00Z")
  it("flags needs_review, never reviewed and older than 90 days", () => {
    expect(
      needsReview({ status: "needs_review", last_reviewed_at: "2026-05-30T00:00:00Z" }, now),
    ).toBe(true)
    expect(needsReview({ status: "active", last_reviewed_at: null }, now)).toBe(true)
    expect(needsReview({ status: "active", last_reviewed_at: "2026-02-01T00:00:00Z" }, now)).toBe(
      true,
    )
    expect(needsReview({ status: "active", last_reviewed_at: "2026-04-01T00:00:00Z" }, now)).toBe(
      false,
    )
    expect(needsReview({ status: "archived", last_reviewed_at: null }, now)).toBe(false)
  })
})

describe("buildComparison", () => {
  const v = (
    env: string,
    name: string,
    extra: Partial<ComparisonVariable> = {},
  ): ComparisonVariable => ({
    environment_id: env,
    name,
    is_required: true,
    is_sensitive: false,
    configuration_status: "configured",
    verification_method: "manual",
    last_verified_at: "2026-05-01T00:00:00Z",
    secret_reference_id: null,
    account_secret_id: null,
    ...extra,
  })

  it("builds a presence matrix and flags gaps first", () => {
    const rows = buildComparison(
      ["dev", "prod"],
      [
        v("dev", "DATABASE_URL", { is_sensitive: true, secret_reference_id: "r1" }),
        v("prod", "DATABASE_URL", { is_sensitive: true, account_secret_id: "s1" }),
        v("dev", "SENTRY_DSN"),
        v("prod", "REDIS_URL", { configuration_status: "unknown" }),
        v("dev", "DEBUG", { is_required: false }),
        v("other", "IGNORED"),
      ],
    )
    expect(rows.map((r) => [r.name, r.attention])).toEqual([
      ["REDIS_URL", true],
      ["SENTRY_DSN", true],
      ["DATABASE_URL", false],
      ["DEBUG", false],
    ])
    const db = rows.find((r) => r.name === "DATABASE_URL")!
    expect(db.sensitive).toBe(true)
    expect(db.cells.dev).toMatchObject({ present: true, hasReference: true, inVault: false })
    expect(db.cells.prod).toMatchObject({ present: true, hasReference: false, inVault: true })
    expect(rows.find((r) => r.name === "SENTRY_DSN")!.cells.prod).toEqual({ present: false })
    expect(rows.some((r) => r.name === "IGNORED")).toBe(false)
  })

  it("has no value anywhere in its output", () => {
    const rows = buildComparison(["a"], [v("a", "API_KEY", { is_sensitive: true })])
    expect(Object.keys(rows[0]!.cells.a!)).not.toContain("value")
  })
})

describe("schemas", () => {
  const env = {
    name: "Staging",
    environment_type: "staging",
    machine_label: "",
    application_url: "",
    api_url: "",
    deployment_provider: "",
    server_hostname: "",
    operating_system: "",
    runtime_versions: "",
    deployment_branch: "",
    deployment_method: "",
    notes: "",
  }

  it("refuses hostnames with credentials and secrets in notes", () => {
    expect(
      environmentUpdateSchema.safeParse({ ...env, server_hostname: "10.0.0.1:22" }).success,
    ).toBe(true)
    expect(
      environmentUpdateSchema.safeParse({ ...env, server_hostname: "root@10.0.0.1" }).success,
    ).toBe(false)
    expect(
      environmentUpdateSchema.safeParse({ ...env, notes: "DATABASE_PASSWORD=hunter2hunter2" })
        .success,
    ).toBe(false)
    expect(environmentUpdateSchema.safeParse({ ...env, status: "archived" }).success).toBe(false)
  })

  it("normalises variable names and refuses integration verification", () => {
    const base = {
      name: "DATABASE_URL=postgres://x",
      is_required: true,
      is_sensitive: true,
      configuration_status: "configured",
      verification_method: "manual",
      notes: "",
      secret_reference_id: "",
      account_secret_id: "",
    }
    expect(variableSchema.parse(base)).toMatchObject({
      name: "DATABASE_URL",
      secret_reference_id: null,
      account_secret_id: null,
    })
    // The value lives in one place: the vault or another vault, not both (Plan P12.3).
    const ids = {
      secret_reference_id: "11111111-1111-4111-8111-111111111111",
      account_secret_id: "22222222-2222-4222-8222-222222222222",
    }
    expect(variableSchema.safeParse({ ...base, ...ids }).success).toBe(false)
    expect(
      variableSchema.safeParse({ ...base, account_secret_id: ids.account_secret_id }).success,
    ).toBe(true)
    expect(variableSchema.safeParse({ ...base, verification_method: "integration" }).success).toBe(
      false,
    )
    expect(variableSchema.safeParse({ ...base, name: "1BAD" }).success).toBe(false)
  })

  it("keeps secret references to locators", () => {
    const ok = secretReferenceSchema.safeParse({
      provider: "1Password",
      vault_project_or_workspace: "Engineering",
      vault_path_or_item_id: "op://Engineering/Portal DB",
      key_name: "password",
      vault_url: "",
    })
    expect(ok.success).toBe(true)
    const pem = secretReferenceSchema.safeParse({
      provider: "Other",
      vault_project_or_workspace: "",
      vault_path_or_item_id: "-----BEGIN PRIVATE KEY----- abc",
      key_name: "",
      vault_url: "",
    })
    expect(pem.success).toBe(false)
  })

  it("parses related variable names on instances", () => {
    const base = {
      project_service_id: "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
      environment_id: "1b4e28ba-2fa1-11d2-883f-0016d3cca428",
      resource_name: "",
      region: "",
      endpoint_hostname: "db.internal:5432",
      version_or_plan: "",
      status: "active",
      related_variables: "DATABASE_URL, DIRECT_URL DATABASE_URL",
      notes: "",
    }
    expect(instanceSchema.parse(base).related_variables).toEqual(["DATABASE_URL", "DIRECT_URL"])
    expect(
      instanceSchema.safeParse({ ...base, endpoint_hostname: "postgres://u:p@db:5432" }).success,
    ).toBe(false)
  })
})
