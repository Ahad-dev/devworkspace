/**
 * Rehearses the owner import (scripts/import-projects.mts) on a THROWAWAY user, so the database has
 * accepted every row before the owner's account is touched.
 *
 *   node scripts/import-rehearse.mts imports/projects.json          import, check, re-run, delete the user
 *   node scripts/import-rehearse.mts imports/projects.json --keep   keep the user to look at in the app
 *   node scripts/import-rehearse.mts --delete                       delete the kept user
 *
 * Uses the test helpers (secret key from .env.test.local, only to create and delete the user; refuses
 * any project other than SUPABASE_TEST_PROJECT_REF). Rows are written as the throwaway user.
 * A kept user's sign-in is stored in .import-rehearsal-user.json (gitignored) and never printed.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"

import type * as TestSupport from "../tests/support/supabase"
import type * as Core from "./import/core"

const [printWarning] = process.listeners("warning")
process.removeAllListeners("warning")
process.on("warning", (w) => {
  if (!("code" in w && w.code === "MODULE_TYPELESS_PACKAGE_JSON")) printWarning?.(w)
})

const root = join(import.meta.dirname, "..")
const load = (path: string) => import(pathToFileURL(join(root, path)).href)
const stateFile = join(root, ".import-rehearsal-user.json")

await load("tests/support/load-env.ts")
const { createTestUser, deleteTestUser }: typeof TestSupport = await load(
  "tests/support/supabase.ts",
)

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { keep: { type: "boolean" }, delete: { type: "boolean" } },
})

if (values.delete) {
  if (!existsSync(stateFile)) {
    console.log("No rehearsal user recorded.")
    process.exit(0)
  }
  const { id } = JSON.parse(readFileSync(stateFile, "utf8")) as { id: string }
  await deleteTestUser(id)
  rmSync(stateFile)
  console.log(`Deleted rehearsal user ${id}.`)
  process.exit(0)
}
if (positionals.length !== 1) {
  console.error("Usage: node scripts/import-rehearse.mts <file.json> [--keep] | --delete")
  process.exit(2)
}
if (existsSync(stateFile)) {
  console.error(
    "A kept rehearsal user exists. Delete it first: node scripts/import-rehearse.mts --delete",
  )
  process.exit(2)
}

const file = resolve(positionals[0]!)
const data: unknown = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""))
const core: typeof Core = await load("scripts/import/core.ts")
const { findSecrets } = await load("src/lib/security/secret-guard.ts")
const { Constants } = await load("src/types/database.types.ts")
const deps: Core.PrepareDeps = {
  enums: Constants.public.Enums,
  findSecrets,
  readFile: (p) => readFile(p, "utf8"),
  baseDir: dirname(file),
}

const user = await createTestUser("import")
let ok = false
try {
  const started = Date.now()
  const first = await core.importWorkspace(user.client, data, {
    ...deps,
    log: () => {},
    confirm: async () => true,
  })
  if (first.outcome !== "done") throw new Error(`first run: ${JSON.stringify(report(first))}`)
  console.log(`Imported in ${Math.round((Date.now() - started) / 1000)}s:`)
  for (const p of first.projects) console.log(`  ${p.status.padEnd(8)} ${p.name}`, p.counts)

  // Spot checks beyond the counts importWorkspace already verified.
  const db = user.client
  const { data: vars, error } = await db
    .from("environment_variables")
    .select("verification_method, configuration_status, last_verified_at, is_sensitive, name")
  if (error) throw new Error(`variables: ${error.code}`)
  const wrong = (vars ?? []).filter(
    (v) =>
      v.verification_method !== "imported" ||
      (v.last_verified_at !== null) !== ["configured", "missing"].includes(v.configuration_status),
  )
  if (wrong.length) throw new Error(`${wrong.length} variables with an unexpected method or date`)
  const sensitive = (vars ?? []).filter((v) => v.is_sensitive).length
  console.log(
    `Variables: ${vars?.length ?? 0} names, ${sensitive} marked sensitive, all "imported".`,
  )

  const { data: envs } = await db.from("environments").select("last_reviewed_at")
  console.log(
    `Environments: ${envs?.length ?? 0}, ${(envs ?? []).filter((e) => !e.last_reviewed_at).length} awaiting review.`,
  )

  const second = await core.importWorkspace(user.client, data, {
    ...deps,
    log: () => {},
    confirm: async () => true,
  })
  const notSkipped =
    second.outcome === "done" ? second.projects.filter((p) => p.status !== "skipped") : null
  if (!notSkipped || notSkipped.length)
    throw new Error(`re-run should skip every project: ${JSON.stringify(report(second))}`)
  console.log("Re-run: every project skipped.")
  ok = true
} catch (e) {
  console.error(`Rehearsal error: ${(e as Error).message}`)
} finally {
  await user.client.auth.signOut({ scope: "local" })
  if (values.keep && ok) {
    writeFileSync(
      stateFile,
      JSON.stringify({ id: user.id, email: user.email, password: user.password }),
    )
    console.log(
      `Kept rehearsal user ${user.email}. Delete it with: node scripts/import-rehearse.mts --delete`,
    )
  } else {
    await deleteTestUser(user.id)
    console.log(`Deleted rehearsal user ${user.id}.`)
  }
}
console.log(ok ? "Rehearsal passed." : "Rehearsal failed.")
process.exit(ok ? 0 : 1)

/** The report without document bodies or anything else bulky. */
function report(r: Core.ImportReport) {
  if (r.outcome === "invalid") return { outcome: r.outcome, issues: r.issues }
  if (r.outcome === "cancelled") return { outcome: r.outcome }
  return {
    outcome: r.outcome,
    projects: r.projects.map(({ name, status, stage, code, message }) => ({
      name,
      status,
      stage,
      code,
      message,
    })),
  }
}
