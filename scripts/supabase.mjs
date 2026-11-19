#!/usr/bin/env node
/**
 * Runs the Supabase CLI. Resolution order:
 *   1. $SUPABASE_BIN
 *   2. .tools/supabase-cli/supabase(.exe), a standalone binary (gitignored; see docs/IMPLEMENTATION_PLAN.md §10)
 *   3. `supabase` on PATH (pnpm scripts put node_modules/.bin first, so a `supabase` devDependency wins)
 *
 * `--types-out <file>` as the first argument captures stdout and writes it to <file>, but only if
 * the command succeeds. That way a failed `gen types` never truncates the committed types file.
 */
import { spawnSync } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const ext = process.platform === "win32" ? ".exe" : ""
const local = join(root, ".tools", "supabase-cli", `supabase${ext}`)

const bin = process.env.SUPABASE_BIN || (existsSync(local) ? local : "supabase")
const onPath = bin === "supabase"

let args = process.argv.slice(2)
let typesOut = null
if (args[0] === "--types-out") {
  typesOut = args[1]
  args = args.slice(2)
}

const result = spawnSync(bin, args, {
  cwd: root,
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
