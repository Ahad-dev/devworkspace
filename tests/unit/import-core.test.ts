import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import { findSecrets } from "@/lib/security/secret-guard"
import { Constants, type Database } from "@/types/database.types"

import {
  importWorkspace,
  looksSensitive,
  prepareImport,
  type PrepareDeps,
} from "../../scripts/import/core"

/** The owner import's validation and secret screening (Plan §10, 2026-11-20). No network. */
const dir = join(process.cwd(), "tests/fixtures/import")
const sample = () => JSON.parse(readFileSync(join(dir, "sample.json"), "utf8"))
const deps: PrepareDeps = {
  enums: Constants.public.Enums,
  findSecrets,
  readFile: (p) => readFile(p, "utf8"),
  baseDir: dir,
}
const TOKEN = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"

async function issuesFor(mutate: (d: ReturnType<typeof sample>) => void, d = deps) {
  const data = sample()
  mutate(data)
  const result = await prepareImport(data, d)
  if (result.ok) throw new Error("expected the file to be refused")
  return result.issues
}

describe("prepareImport", () => {
  it("accepts the sample and fills every column", async () => {
    const result = await prepareImport(sample(), deps)
    if (!result.ok) throw new Error(JSON.stringify(result.issues))
    const [alpha, beta] = result.projects
    expect(alpha!.counts).toEqual({
      repositories: 2,
      technologies: 3,
      environments: 2,
      variables: 8,
      services: 2,
      instances: 2,
      tasks: 2,
      documents: 2,
      commands: 3,
    })
    expect(beta!.counts.environments).toBe(1)
    expect(alpha!.project).not.toHaveProperty("owner_id")
    expect(alpha!.project.target_date).toBeNull()

    const local = alpha!.variables.filter((v) => v.env === "local")
    expect(local.map((v) => [v.row.name, v.row.configuration_status, v.row.is_sensitive])).toEqual([
      ["DATABASE_URL", "configured", true],
      ["JWT_SECRET", "configured", true],
      ["PORT", "configured", false],
      ["NEXT_PUBLIC_API_URL", "configured", false],
      ["SENTRY_DSN", "unknown", true],
    ])
    expect(alpha!.variables.every((v) => v.row.verification_method === "imported")).toBe(true)
    expect(
      alpha!.variables.find((v) => v.row.name === "NEXT_PUBLIC_API_URL")!.row.is_required,
    ).toBe(false)
    expect(alpha!.documents[0]!.row.content_markdown).toBe(
      readFileSync(join(dir, "runbook.md"), "utf8"),
    )
    expect(alpha!.commands[2]!.row).toMatchObject({ is_destructive: true, shell: "powershell" })
  })

  it("refuses unknown fields such as owner_id", async () => {
    const issues = await issuesFor((d) => (d.projects[0].owner_id = "someone-else"))
    expect(issues[0]!.path).toBe("projects.0")
  })

  it("refuses a value outside an enum", async () => {
    const issues = await issuesFor((d) => (d.projects[0].project_type = "startup"))
    expect(issues.map((i) => i.path)).toContain("projects.0.project_type")
  })

  it("refuses references to unknown keys", async () => {
    const issues = await issuesFor((d) => {
      d.projects[0].commands[0].repo = "nope"
      d.projects[0].services[0].instances[1].env = "staging"
    })
    expect(issues).toEqual(
      expect.arrayContaining([
        { path: "projects.0.commands.0.repo", rule: 'unknown repository key "nope"' },
        {
          path: "projects.0.services.0.instances.1.env",
          rule: 'unknown environment key "staging"',
        },
      ]),
    )
  })

  it("refuses names that differ only by case where the database does", async () => {
    const issues = await issuesFor((d) => {
      d.projects[0].environments[1].name = "local"
      d.projects[1].name = "import fixture ALPHA"
    })
    const rules = issues.map((i) => i.rule)
    expect(rules).toContain('duplicate environment name "local"')
    expect(rules).toContain('duplicate project name "import fixture alpha"')
  })

  it("refuses a git remote with a username", async () => {
    const issues = await issuesFor(
      (d) => (d.projects[0].repositories[0].remote_url = "https://user@github.com/example/a.git"),
    )
    expect(issues.map((i) => i.path)).toContain("projects.0.repositories.0.remote_url")
  })

  it("refuses a server hostname with a scheme", async () => {
    const issues = await issuesFor(
      (d) => (d.projects[0].environments[1].server_hostname = "https://api.example.com"),
    )
    expect(issues.map((i) => i.path)).toContain("projects.0.environments.1.server_hostname")
  })

  it("refuses NAME=value as a variable name", async () => {
    const issues = await issuesFor((d) => d.projects[0].environments[0].variables.push("PORT=3000"))
    expect(issues.map((i) => i.path)).toContain("projects.0.environments.0.variables.5")
  })

  it("refuses a target date before the start date", async () => {
    const issues = await issuesFor((d) => (d.projects[0].target_date = "2025-12-31"))
    expect(issues.map((i) => i.rule)).toContain("target_date is before start_date")
  })

  it("refuses a document over 100,000 characters", async () => {
    const issues = await issuesFor(
      (d) => (d.projects[0].documents[1].content = "x".repeat(100_001)),
    )
    expect(issues.map((i) => i.rule)).toContain("document is over 100,000 characters")
  })

  it("refuses a connection string with a template password", async () => {
    const issues = await issuesFor(
      (d) =>
        (d.projects[0].commands[1].command =
          "psql postgresql://postgres:[YOUR-PASSWORD]@db.example.supabase.co:5432/postgres"),
    )
    expect(issues).toContainEqual({
      path: "projects.0.commands.1.command",
      rule: "secret: credential-url",
    })
  })

  it("reports a token by path and kind, never the token itself", async () => {
    const issues = await issuesFor((d) => (d.projects[0].notes = `old key ${TOKEN}`))
    expect(issues).toContainEqual({ path: "projects.0.notes", rule: "secret: known-key" })
    expect(JSON.stringify(issues)).not.toContain(TOKEN)
  })

  it("reports a secret in a document file as file:line", async () => {
    const issues = await issuesFor(() => {}, {
      ...deps,
      readFile: async () => `# Runbook\n\nexport GITHUB_TOKEN=${TOKEN}\n`,
    })
    expect(issues).toContainEqual({ path: "runbook.md:3", rule: "secret: known-key" })
    expect(JSON.stringify(issues)).not.toContain(TOKEN)
  })

  it("reports a document file that can't be read", async () => {
    const issues = await issuesFor((d) => (d.projects[0].documents[0].file = "missing.md"))
    expect(issues).toContainEqual({
      path: "projects.0.documents.0",
      rule: "can't read file missing.md",
    })
  })
})

describe("looksSensitive", () => {
  it.each([
    ["DATABASE_URL", true],
    ["DIRECT_DATABASE_URL", true],
    ["REDIS_URL", true],
    ["JWT_SECRET", true],
    ["AWS_ACCESS_KEY_ID", true],
    ["B2_APPLICATION_KEY", true],
    ["SENTRY_DSN", true],
    ["TWILIO_AUTH_TOKEN", true],
    ["APP_KEY", true],
    ["NEXT_PUBLIC_API_URL", false],
    ["NEXT_PUBLIC_GEOCODER_API_KEY", false],
    ["PLATFORM_STRIPE_PUBLISHABLE_KEY", false],
    ["VITE_APP_NAME", false],
    ["PORT", false],
    ["JWT_ACCESS_EXPIRY", false],
    ["AWS_REGION", false],
  ])("%s → %s", (name, expected) => {
    expect(looksSensitive(name)).toBe(expected)
  })
})

describe("importWorkspace without writing", () => {
  function fakeClient() {
    const from = vi.fn(() => ({
      select: async () => ({ data: [{ id: "x", name: "Import Fixture Beta" }], error: null }),
      insert: () => {
        throw new Error("must not insert")
      },
    }))
    return { client: { from } as unknown as SupabaseClient<Database>, from }
  }

  it("never touches the database when the file is invalid", async () => {
    const { client, from } = fakeClient()
    const data = sample()
    data.projects[0].notes = TOKEN
    const report = await importWorkspace(client, data, { ...deps, log: () => {} })
    expect(report.outcome).toBe("invalid")
    expect(from).not.toHaveBeenCalled()
  })

  it("asks first, lists existing names as skipped, and writes nothing when declined", async () => {
    const { client, from } = fakeClient()
    const confirm = vi.fn(async () => false)
    const report = await importWorkspace(client, sample(), { ...deps, log: () => {}, confirm })
    expect(confirm).toHaveBeenCalledWith({
      create: ["Import Fixture Alpha"],
      skip: ["Import Fixture Beta"],
    })
    expect(report.outcome).toBe("cancelled")
    expect(from).toHaveBeenCalledTimes(1)
  })
})
