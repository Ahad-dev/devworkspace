/**
 * One-off import of the owner's projects (Plan §10, 2026-11-20). Run ONLY by the owner, in their own
 * terminal:
 *
 *   node scripts/import-projects.mts imports/projects.json --dry-run   check the file, no network
 *   node scripts/import-projects.mts imports/projects.json             sign in and import
 *   node scripts/import-projects.mts imports/projects.json --only epi-car,hupm
 *
 * Signs in with the publishable key and the owner's email and password (typed here, hidden, never
 * stored or logged), so every row goes through RLS and the column grants exactly as in the app.
 * Projects whose name already exists are skipped. A project that fails part-way is deleted again.
 */
import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { Writable } from "node:stream"
import { pathToFileURL } from "node:url"
import { parseArgs, parseEnv } from "node:util"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "../src/types/database.types"
import type * as Core from "./import/core"

// Loading the TypeScript helpers prints a harmless module-type warning; hide only that one.
const [printWarning] = process.listeners("warning")
process.removeAllListeners("warning")
process.on("warning", (w) => {
  if (!("code" in w && w.code === "MODULE_TYPELESS_PACKAGE_JSON")) printWarning?.(w)
})

const root = join(import.meta.dirname, "..")
const load = (path: string) => import(pathToFileURL(join(root, path)).href)

const USAGE = "Usage: node scripts/import-projects.mts <file.json> [--dry-run] [--only key,key]"

const args = (() => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: { "dry-run": { type: "boolean" }, only: { type: "string" } },
    })
  } catch (e) {
    fail(2, `${(e as Error).message}\n${USAGE}`)
  }
})()
if (args.positionals.length !== 1) fail(2, USAGE)

const file = resolve(args.positionals[0]!)
let data: unknown
try {
  data = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""))
} catch (e) {
  fail(2, `Can't read ${file}: ${(e as Error).message}`)
}

const core: typeof Core = await load("scripts/import/core.ts")
const { findSecrets } = await load("src/lib/security/secret-guard.ts")
const { Constants } = await load("src/types/database.types.ts")
const deps: Core.PrepareDeps = {
  enums: Constants.public.Enums,
  findSecrets,
  readFile: (p) => readFile(p, "utf8"),
  baseDir: dirname(file),
}

const only = args.values.only
  ?.split(",")
  .map((k) => k.trim())
  .filter(Boolean)

/* 1. Validate and screen (no network) ---------------------------------------------------------- */

const prep = await core.prepareImport(data, deps)
for (const w of prep.warnings) console.log(`warning  ${w.path}: ${w.rule}`)
if (!prep.ok) {
  for (const i of prep.issues) console.log(`issue    ${i.path}: ${i.rule}`)
  fail(1, `\n${prep.issues.length} issue(s). Nothing was written. Fix the file and run again.`)
}
if (only) {
  const unknown = only.filter((k) => !prep.projects.some((p) => p.key === k))
  if (unknown.length) fail(2, `Unknown project key(s) for --only: ${unknown.join(", ")}`)
}

const chosen = only ? prep.projects.filter((p) => only.includes(p.key)) : prep.projects
console.log("")
for (const p of chosen) {
  const c = p.counts
  console.log(
    `${p.name} [${p.key}]: ${c.repositories} repositories, ${c.technologies} technologies, ` +
      `${c.environments} environments, ${c.variables} variable names, ${c.services} services ` +
      `(${c.instances} instances), ${c.tasks} tasks, ${c.documents} documents, ${c.commands} commands`,
  )
}

if (args.values["dry-run"]) {
  console.log("\nDry run: the file is valid and passed secret screening. Nothing was written.")
  process.exit(0)
}

/* 2. Sign in as the owner ---------------------------------------------------------------------- */

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  fail(2, "Run this in an interactive terminal: it asks for your password.")
}

let url: string | undefined
let publishableKey: string | undefined
try {
  const env = parseEnv(readFileSync(join(root, ".env.local"), "utf8"))
  url = env.NEXT_PUBLIC_SUPABASE_URL
  publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
} catch {
  fail(2, "Can't read .env.local (it needs NEXT_PUBLIC_SUPABASE_URL and the publishable key).")
}
if (!url?.startsWith("https://") || !publishableKey) {
  fail(
    2,
    ".env.local needs NEXT_PUBLIC_SUPABASE_URL (https) and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  )
}
if (publishableKey.startsWith("sb_secret_")) {
  fail(2, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a secret key. Refusing to run.")
}
const host = new URL(url).hostname

console.log(`\nSign in to DevWorkspace (${host}). Your password is not shown, stored or logged.`)
const email = (await ask("Email: ")).trim()
const password = await ask("Password: ", true)
if (!email || !password) fail(2, "Email and password are required.")

const client = createClient<Database>(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const { error: signInError } = await client.auth.signInWithPassword({ email, password })
if (signInError) fail(1, `Sign-in failed: ${signInError.message}`)

/* 3. Import ------------------------------------------------------------------------------------ */

const controller = new AbortController()
process.on("SIGINT", () => {
  if (controller.signal.aborted) process.exit(130)
  console.log("\nStopping after the current step; the project in progress will be rolled back…")
  controller.abort()
})

let exitCode = 0
try {
  const report = await core.importWorkspace(client, data, {
    ...deps,
    only,
    signal: controller.signal,
    log: (line) => console.log(line),
    confirm: async ({ create, skip }) => {
      console.log("")
      for (const name of create) console.log(`  create  ${name}`)
      for (const name of skip) console.log(`  skip    ${name} (a project with this name exists)`)
      if (!create.length) {
        console.log("Nothing to import.")
        return false
      }
      const answer = await ask(
        `Import ${create.length}, skip ${skip.length} into ${email} on ${host}? [y/N] `,
      )
      return /^y(es)?$/i.test(answer.trim())
    },
  })

  if (report.outcome === "invalid") {
    for (const i of report.issues) console.log(`issue    ${i.path}: ${i.rule}`)
    exitCode = 1
  } else if (report.outcome === "cancelled") {
    console.log("Cancelled. Nothing was written.")
  } else {
    console.log("")
    for (const p of report.projects) {
      if (p.status === "failed") {
        console.log(
          `  failed   ${p.name}: ${p.stage} (${p.code}) ${p.message ?? ""}` +
            (p.rolledBack ? " — rolled back" : " — NOT rolled back: delete it in the app"),
        )
      } else {
        console.log(`  ${p.status.padEnd(8)} ${p.name}`)
      }
    }
    if (report.outcome === "failed") {
      console.log(
        "\nThe import stopped. Projects listed as created are complete; run again to continue.",
      )
      exitCode = 1
    } else {
      console.log(
        "\nDone. Imported environments show “Needs review”: check each one in the app and mark it reviewed.",
      )
    }
  }
} catch (e) {
  console.error(`Import failed: ${(e as Error).message}`)
  exitCode = 1
} finally {
  // Local scope: ends only this script's session, not the owner's browser sessions.
  await client.auth.signOut({ scope: "local" })
}
process.exit(exitCode)

/* Helpers -------------------------------------------------------------------------------------- */

function fail(code: number, message: string): never {
  console.error(message)
  process.exit(code)
}

/** Reads one line from the terminal; with `hidden`, typed characters are not echoed. */
async function ask(query: string, hidden = false): Promise<string> {
  let muted = false
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk)
      callback()
    },
  })
  const rl = createInterface({ input: process.stdin, output, terminal: true })
  rl.on("SIGINT", () => {
    process.stdout.write("\n")
    rl.close()
    process.exit(130)
  })
  try {
    const answer = rl.question(query)
    muted = hidden
    const value = await answer
    if (hidden) process.stdout.write("\n")
    return value
  } finally {
    rl.close()
  }
}
