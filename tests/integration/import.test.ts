import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { findSecrets } from "@/lib/security/secret-guard"
import { Constants } from "@/types/database.types"

import { importWorkspace, type ImportDeps } from "../../scripts/import/core"
import { createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * The owner import (Plan §10, 2026-11-20) against the real database, as a throwaway user: rows go
 * through RLS, grants and checks; a re-run skips; secrets are refused before writing, and a project
 * the database rejects part-way is removed again.
 */
describe("owner project import", () => {
  let user: TestUser
  const dir = join(process.cwd(), "tests/fixtures/import")
  const sample = () => JSON.parse(readFileSync(join(dir, "sample.json"), "utf8"))
  const deps: ImportDeps = {
    enums: Constants.public.Enums,
    findSecrets,
    readFile: (p) => readFile(p, "utf8"),
    baseDir: dir,
    log: () => {},
    confirm: async () => true,
  }
  const TOKEN = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"

  beforeAll(async () => {
    user = await createTestUser("import")
  })

  afterAll(async () => {
    if (user) await deleteTestUser(user.id)
  })

  async function projectNamed(name: string) {
    const { data } = await user.client.from("projects").select("id, owner_id").eq("name", name)
    return data ?? []
  }

  it("imports both projects with their links", async () => {
    const report = await importWorkspace(user.client, sample(), deps)
    expect(report.outcome).toBe("done")
    if (report.outcome !== "done") return
    expect(report.projects.map((p) => [p.name, p.status])).toEqual([
      ["Import Fixture Alpha", "created"],
      ["Import Fixture Beta", "created"],
    ])

    const [alpha] = await projectNamed("Import Fixture Alpha")
    expect(alpha!.owner_id).toBe(user.id)
    const db = user.client

    const { data: techs } = await db
      .from("project_technologies")
      .select("name, repositories(name)")
      .eq("project_id", alpha!.id)
      .order("name")
    expect(techs!.map((t) => [t.name, t.repositories?.name ?? null])).toEqual([
      ["NestJS", "alpha-api"],
      ["Next.js", "alpha-web"],
      ["PostgreSQL", null],
    ])

    const { data: vars } = await db
      .from("environment_variables")
      .select(
        "name, configuration_status, verification_method, last_verified_at, environments(name)",
      )
      .eq("project_id", alpha!.id)
    expect(vars).toHaveLength(8)
    expect(vars!.every((v) => v.verification_method === "imported")).toBe(true)
    const localDb = vars!.find(
      (v) => v.name === "DATABASE_URL" && v.environments?.name === "Local",
    )!
    expect(localDb.configuration_status).toBe("configured")
    expect(localDb.last_verified_at).not.toBeNull()
    const prodDb = vars!.find(
      (v) => v.name === "DATABASE_URL" && v.environments?.name === "Production",
    )!
    expect(prodDb.configuration_status).toBe("unknown")
    expect(prodDb.last_verified_at).toBeNull()

    const { data: instances } = await db
      .from("service_instances")
      .select("related_variables, environments(name), project_services(name)")
      .eq("project_id", alpha!.id)
    expect(instances).toHaveLength(2)
    expect(instances!.every((i) => i.project_services?.name === "PostgreSQL")).toBe(true)

    const { data: docs } = await db
      .from("documents")
      .select("title, content_markdown, environments(name)")
      .eq("project_id", alpha!.id)
      .eq("title", "Runbook")
      .single()
    expect(docs!.content_markdown).toBe(readFileSync(join(dir, "runbook.md"), "utf8"))
    expect(docs!.environments?.name).toBe("Production")

    const { data: commands } = await db
      .from("command_snippets")
      .select("title, is_destructive, repositories(name), environments(name)")
      .eq("project_id", alpha!.id)
      .order("title")
    expect(commands!.map((c) => [c.title, c.is_destructive, c.repositories?.name ?? null])).toEqual(
      [
        ["Apply migrations", false, "alpha-api"],
        ["Reset local volumes", true, null],
        ["Start the API", false, "alpha-api"],
      ],
    )

    const { data: tasks } = await db
      .from("tasks")
      .select("title, status, priority")
      .eq("project_id", alpha!.id)
      .order("sort_order")
    expect(tasks).toEqual([
      { title: "Rotate the webhook secret", status: "ready", priority: "urgent" },
      { title: "Write the deploy runbook", status: "inbox", priority: "medium" },
    ])
  })

  it("skips projects that already exist on a re-run", async () => {
    const report = await importWorkspace(user.client, sample(), deps)
    expect(report.outcome).toBe("done")
    if (report.outcome !== "done") return
    expect(report.projects.map((p) => p.status)).toEqual(["skipped", "skipped"])
    expect(await projectNamed("Import Fixture Alpha")).toHaveLength(1)
  })

  it("refuses a token before writing anything", async () => {
    const data = sample()
    data.projects[1].name = "Import Fixture Token"
    data.projects[1].commands[0].command = `GH_TOKEN=${TOKEN} gh repo list`
    const report = await importWorkspace(user.client, data, deps)
    expect(report.outcome).toBe("invalid")
    expect(await projectNamed("Import Fixture Token")).toHaveLength(0)
  })

  it("rolls a project back when the database rejects a row part-way", async () => {
    const data = sample()
    data.projects[0].name = "Import Fixture Rollback"
    data.projects[0].commands[2].command = `echo ${TOKEN}`
    // Turn off client-side screening so the database's own no_secret_text check is what refuses.
    const report = await importWorkspace(user.client, data, { ...deps, findSecrets: () => [] })
    expect(report.outcome).toBe("failed")
    if (report.outcome !== "failed") return
    const failed = report.projects.find((p) => p.name === "Import Fixture Rollback")!
    expect(failed).toMatchObject({ status: "failed", stage: "command_snippets", rolledBack: true })
    expect(JSON.stringify(report)).not.toContain(TOKEN)
    expect(await projectNamed("Import Fixture Rollback")).toHaveLength(0)

    const { count } = await user.client
      .from("environments")
      .select("id", { count: "exact", head: true })
    expect(count).toBe(3) // Alpha's two and Beta's one: nothing left from the rolled-back project
  })
})
