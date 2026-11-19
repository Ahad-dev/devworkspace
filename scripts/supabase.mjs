#!/usr/bin/env node
/**
 * Runs the Supabase CLI. Resolution order:
 *   1. $SUPABASE_BIN
 *   2. .tools/supabase-cli/supabase(.exe), a standalone binary (gitignored; see docs/IMPLEMENTATION_PLAN.md §10)
 *   3. `supabase` on PATH (pnpm scripts put node_modules/.bin first, so a `supabase` devDependency wins)
 *
 * `--types-out <file>` as the first argument captures stdout and writes it to <file>, but only if
 * the command succeeds. That way a failed `gen types` never truncates the committed types file.
 *
 * Database password: if .env.supabase.local (gitignored) defines SUPABASE_DB_PASSWORD, it is passed to
 * the CLI, unless the shell already sets it. Remote database commands then connect with the password
 * instead of a temporary login role, which needs a token with Database Read-write. The value is never printed.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const ext = process.platform === "win32" ? ".exe" : ""
const local = join(root, ".tools", "supabase-cli", `supabase${ext}`)

const bin = process.env.SUPABASE_BIN || (existsSync(local) ? local : "supabase")
const onPath = bin === "supabase"

const env = { ...process.env }
const localEnvFile = join(root, ".env.supabase.local")
if (!env.SUPABASE_DB_PASSWORD && existsSync(localEnvFile)) {
  for (const line of readFileSync(localEnvFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*SUPABASE_DB_PASSWORD\s*=\s*(.*?)\s*$/)
    if (m?.[1]) env.SUPABASE_DB_PASSWORD = m[1].replace(/^(['"])(.*)\1$/, "$2")
  }
}

let args = process.argv.slice(2)
let typesOut = null
if (args[0] === "--types-out") {
  typesOut = args[1]
  args = args.slice(2)
}

const result = spawnSync(bin, args, {
  cwd: root,
  env,
  stdio: typesOut ? ["inherit", "pipe", "inherit"] : "inherit",
  shell: onPath && process.platform === "win32",
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})

if (result.error) {
  console.error(
    onPath
      ? "Supabase CLI not found. Install it (see README) or set SUPABASE_BIN."
      : `Failed to run ${bin}: ${result.error.message}`,
  )
  process.exit(1)
}

if (typesOut && result.status === 0) {
  writeFileSync(join(root, typesOut), result.stdout)
  console.log(`Wrote ${typesOut}`)
}

process.exit(result.status ?? 1)
