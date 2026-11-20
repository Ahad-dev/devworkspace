/**
 * Sample data for performance checks (Plan P7.7). DEV PROJECT ONLY.
 *
 *   node scripts/seed-dev.mts            create a throwaway user and load a busy workspace
 *   node scripts/seed-dev.mts --delete   delete the user from the last run (and its files)
 *
 * Uses the test helpers (secret key from .env.test.local, refuses any project other than
 * SUPABASE_TEST_PROJECT_REF). Rows are inserted as the user, so RLS, triggers and activity behave
 * as in the app. The user's id is kept in .seed-dev-user.json (gitignored); no password is printed.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import type { SupabaseClient } from "@supabase/supabase-js"

const root = join(import.meta.dirname, "..")
await import(pathToFileURL(join(root, "tests/support/load-env.ts")).href)
const { adminClient, createTestUser, deleteTestUser } = await import(
  pathToFileURL(join(root, "tests/support/supabase.ts")).href
)
const stateFile = join(root, ".seed-dev-user.json")

if (process.argv.includes("--delete")) {
  if (!existsSync(stateFile)) {
    console.log("No seeded user recorded.")
    process.exit(0)
  }
  const { id } = JSON.parse(readFileSync(stateFile, "utf8")) as { id: string }
  await deleteTestUser(id)
  rmSync(stateFile)
  console.log(`Deleted seeded user ${id}.`)
  process.exit(0)
}

const SIZE = { projects: 20, tasksPerProject: 75, docsPerProject: 8, commandsPerProject: 6 }

// Deterministic pseudo-random numbers, so runs are comparable.
let seed = 42
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!
const WORDS = [
  "redis",
  "migration",
  "stripe",
  "webhook",
  "cache",
  "auth",
  "session",
  "invoice",
  "deploy",
  "rollback",
  "index",
  "query",
  "queue",
  "email",
  "upload",
  "billing",
  "search",
  "dashboard",
  "timeout",
  "retry",
  "schema",
  "token",
  "refresh",
  "report",
  "export",
  "import",
  "sync",
]
const sentence = (n: number) =>
  Array.from({ length: n }, () => pick(WORDS))
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase()) + "."

const user = await createTestUser("seed")
writeFileSync(stateFile, JSON.stringify({ id: user.id, email: user.email }))
const c = user.client
await c
  .from("profiles")
  .update({ display_name: "Seed Data", timezone: "Asia/Karachi" })
  .eq("id", user.id)

async function insert(table: string, rows: Record<string, unknown>[], select = "id") {
  const out: { id: string }[] = []
  for (let i = 0; i < rows.length; i += 500) {
    // Untyped on purpose: one helper inserts into many tables.
    const { data, error } = await (c as SupabaseClient)
      .from(table)
      .insert(rows.slice(i, i + 500))
      .select(select)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as unknown as { id: string }[]))
  }
  return out
}

const started = Date.now()
const projects = await insert(
  "projects",
  Array.from({ length: SIZE.projects }, (_, i) => ({
    name: `Project ${String(i + 1).padStart(2, "0")} ${pick(["Portal", "API", "Shop", "CRM", "Tools"])}`,
    project_type: pick(["client", "internal", "personal", "open_source"]),
    status: i < 15 ? "active" : pick(["on_hold", "maintenance", "completed"]),
    priority: pick(["urgent", "high", "medium", "low"]),
    description: sentence(14),
  })),
)

const STATUSES = ["inbox", "ready", "in_progress", "blocked", "review", "done", "done", "done"]
const day = 86_400_000
for (const [pi, p] of projects.entries()) {
  const repos = await insert("repositories", [
    {
      project_id: p.id,
      name: `web-${pi}`,
      provider: "github",
      purpose: "frontend",
      remote_url: `https://github.com/acme/web-${pi}`,
    },
    {
      project_id: p.id,
      name: `api-${pi}`,
      provider: "github",
      purpose: "backend",
      remote_url: `https://github.com/acme/api-${pi}`,
    },
  ])
  await insert("project_technologies", [
    { project_id: p.id, name: "Next.js", category: "frontend", version: "16" },
    { project_id: p.id, name: "PostgreSQL", category: "database", version: "17" },
    {
      project_id: p.id,
      name: pick(["Redis", "Stripe", "Resend", "Sentry"]),
      category: "other",
      version: null,
    },
  ])
  await insert(
    "tasks",
    Array.from({ length: SIZE.tasksPerProject }, (_, i) => {
      const status = pick(STATUSES)
      return {
        project_id: p.id,
        repository_id: pick([null, repos[0]!.id, repos[1]!.id]),
        title: `${pick(["Fix", "Add", "Refactor", "Investigate", "Document"])} ${pick(WORDS)} ${pick(WORDS)} #${i}`,
        description: sentence(30),
        status,
        priority: pick(["urgent", "high", "medium", "medium", "low"]),
        due_at:
          rand() < 0.4
            ? new Date(Date.now() + Math.round((rand() * 40 - 15) * day)).toISOString()
            : null,
        next_action: status === "in_progress" && rand() < 0.7 ? sentence(8) : null,
        blocker_details: status === "blocked" ? "Waiting on the client" : null,
      }
    }),
  )
  const envs = await insert("environments", [
    { project_id: p.id, name: "Local", environment_type: "local" },
    {
      project_id: p.id,
      name: "Staging",
      environment_type: "staging",
      deployment_provider: "Vercel",
    },
    {
      project_id: p.id,
      name: "Production",
      environment_type: "production",
      deployment_provider: "Vercel",
      notes: sentence(20),
    },
  ])
  const varNames = [
    "DATABASE_URL",
    "REDIS_URL",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "SENTRY_DSN",
    "RESEND_API_KEY",
  ]
  await insert(
    "environment_variables",
    envs.flatMap((e) =>
      varNames.map((name) => ({
        project_id: p.id,
        environment_id: e.id,
        name,
        is_required: true,
        is_sensitive: /SECRET|KEY|URL/.test(name),
        configuration_status: pick(["configured", "configured", "unknown", "missing"]),
        verification_method: "manual",
      })),
    ),
  )
  const svc = await insert("project_services", [
    { project_id: p.id, name: "Postgres", category: "database", provider: "Supabase" },
    { project_id: p.id, name: "Cache", category: "cache", provider: "Upstash" },
  ])
  await insert("service_instances", [
    {
      project_id: p.id,
      project_service_id: svc[0]!.id,
      environment_id: envs[2]!.id,
      resource_name: `db-prod-${pi}`,
      status: "active",
      related_variables: ["DATABASE_URL"],
    },
    {
      project_id: p.id,
      project_service_id: svc[1]!.id,
      environment_id: envs[2]!.id,
      resource_name: `redis-prod-${pi}`,
      status: "active",
      related_variables: ["REDIS_URL"],
    },
  ])
  await insert(
    "documents",
    Array.from({ length: SIZE.docsPerProject }, (_, i) => ({
      project_id: p.id,
      title: `${pick(["Setup", "Runbook", "ADR", "API notes", "Troubleshooting"])} ${pick(WORDS)} ${i}`,
      category: pick(["setup", "deployment", "adr", "api", "troubleshooting", "notes"]),
      summary: sentence(10),
      content_markdown: Array.from({ length: 30 }, () => `- ${sentence(18)}`).join("\n"),
    })),
  )
  await insert(
    "command_snippets",
    Array.from({ length: SIZE.commandsPerProject }, (_, i) => ({
      project_id: p.id,
      title: `${pick(["Run", "Deploy", "Migrate", "Test", "Seed"])} ${pick(WORDS)} ${i}`,
      command_text: `pnpm ${pick(["dev", "test", "db:push --yes", "build", "lint"])} -- --filter ${pick(WORDS)}`,
      shell: pick(["bash", "powershell"]),
      operating_system: "cross_platform",
      category: pick(["development", "test", "database", "deployment"]),
      is_destructive: false,
    })),
  )
}

const admin = adminClient()
const counts: Record<string, number> = {}
for (const t of [
  "tasks",
  "documents",
  "command_snippets",
  "environment_variables",
  "activity_events",
]) {
  const { count } = await (admin as SupabaseClient)
    .from(t)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
  counts[t] = count ?? 0
}
await c.auth.signOut()
console.log(`Seeded user ${user.id} in ${Math.round((Date.now() - started) / 1000)}s`, counts)
console.log("Delete it with: node scripts/seed-dev.mts --delete")
