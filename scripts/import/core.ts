/**
 * One-off import of the owner's real projects (Plan §10, 2026-11-20). Validates a data file, screens every
 * string for secret material, then inserts project by project through a signed-in client, so RLS and the
 * column grants apply exactly as in the app. Nothing here ever sets owner_id.
 *
 * Loaded by Node's type stripping (scripts/*.mts) and by Vitest, so: value imports are limited to zod and
 * node:path, and only erasable TypeScript is used.
 */
import { isAbsolute, resolve } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type { Constants, Database, TablesInsert } from "../../src/types/database.types"

type Enums = typeof Constants.public.Enums
type Finding = { kind: string; message: string }

export type PrepareDeps = {
  enums: Enums
  findSecrets: (text: string) => Finding[]
  readFile: (absolutePath: string) => Promise<string>
  /** Folder that relative document paths resolve against (the data file's folder). */
  baseDir: string
}

export type Issue = { path: string; rule: string }

/* Columns the authenticated role may insert (column-level grants in supabase/migrations). */
export const INSERT_COLUMNS = {
  projects: [
    "name",
    "description",
    "project_type",
    "status",
    "priority",
    "start_date",
    "target_date",
    "project_url",
    "documentation_url",
    "notes",
  ],
  repositories: [
    "project_id",
    "name",
    "provider",
    "remote_url",
    "purpose",
    "default_branch",
    "primary_language",
    "local_path",
    "readme_url",
    "notes",
  ],
  project_technologies: ["project_id", "repository_id", "name", "category", "version", "notes"],
  environments: [
    "project_id",
    "name",
    "environment_type",
    "machine_label",
    "application_url",
    "api_url",
    "deployment_provider",
    "server_hostname",
    "operating_system",
    "runtime_versions",
    "deployment_branch",
    "deployment_method",
    "status",
    "notes",
  ],
  environment_variables: [
    "project_id",
    "environment_id",
    "name",
    "is_required",
    "is_sensitive",
    "configuration_status",
    "verification_method",
    "notes",
    "secret_reference_id",
  ],
  project_services: [
    "project_id",
    "name",
    "category",
    "provider",
    "purpose",
    "dashboard_url",
    "documentation_url",
    "notes",
  ],
  service_instances: [
    "project_id",
    "project_service_id",
    "environment_id",
    "resource_name",
    "region",
    "endpoint_hostname",
    "version_or_plan",
    "status",
    "related_variables",
    "notes",
  ],
  tasks: [
    "project_id",
    "repository_id",
    "parent_task_id",
    "title",
    "description",
    "status",
    "priority",
    "next_action",
    "blocker_details",
    "due_at",
    "external_reference_url",
    "sort_order",
  ],
  documents: [
    "project_id",
    "repository_id",
    "environment_id",
    "title",
    "category",
    "summary",
    "content_markdown",
  ],
  command_snippets: [
    "project_id",
    "repository_id",
    "environment_id",
    "title",
    "command_text",
    "description",
    "shell",
    "operating_system",
    "category",
    "prerequisites",
    "is_destructive",
  ],
} as const satisfies {
  [T in ImportTable]: readonly (keyof TablesInsert<T>)[]
}

export type ImportTable =
  | "projects"
  | "repositories"
  | "project_technologies"
  | "environments"
  | "environment_variables"
  | "project_services"
  | "service_instances"
  | "tasks"
  | "documents"
  | "command_snippets"

/** A complete insert row: every granted column present (null where unset), nothing else. */
type Row<T extends ImportTable> = Required<
  Pick<TablesInsert<T>, Extract<(typeof INSERT_COLUMNS)[T][number], keyof TablesInsert<T>>>
>

/* Validation building blocks (mirror the database checks) --------------------------------------- */

const KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/
const HTTP_URL = /^https?:\/\/[^\s/?#@]+([/?#][^\s]*)?$/
const REMOTE_URL = [
  /^https:\/\/[^\s/?#@]+\/[^\s?#]+$/,
  /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[^\s]+$/,
  /^ssh:\/\/([A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+(:[0-9]+)?\/[^\s]+$/,
]
const BRANCH = /^[^\s]{1,255}$/
const SERVER_HOSTNAME = /^[A-Za-z0-9._:\[\]-]{1,255}$/
const ENDPOINT_HOSTNAME = /^[^\s@]{1,255}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const key = z.string().regex(KEY, "key: lowercase letters, digits, - or _ (max 40)")
const text = (min: number, max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length >= min && v.length <= max, `length must be ${min}–${max}`)
const optText = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length <= max, `at most ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null)
const pattern = (re: RegExp, rule: string, max = 2048) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || (v.length <= max && re.test(v)), rule)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null)
const httpUrl = pattern(HTTP_URL, "http(s) URL without credentials")
const remoteUrl = z
  .string()
  .transform((v) => v.trim())
  .refine(
    (v) => v === "" || (v.length <= 1000 && REMOTE_URL.some((re) => re.test(v))),
    "git remote: https://host/path (no user@), git@host:path or ssh://host/path",
  )
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null)
const branch = pattern(BRANCH, "branch: no spaces", 255)
const variableName = z
  .string()
  .regex(VARIABLE_NAME, "variable name: letters, digits, _ (no =value)")

function buildSchema(e: Enums) {
  const variable = z.union([
    variableName,
    z.strictObject({
      name: variableName,
      required: z.boolean().optional(),
      sensitive: z.boolean().optional(),
      status: z.enum(e.configuration_status).optional(),
      notes: optText(2000),
    }),
  ])
  const repository = z.strictObject({
    key,
    name: text(1, 200),
    provider: z.enum(e.repository_provider).default("github"),
    purpose: z.enum(e.repository_purpose).default("other"),
    remote_url: remoteUrl,
    default_branch: branch,
    primary_language: optText(100),
    local_path: optText(1000),
    readme_url: httpUrl,
    notes: optText(5000),
  })
  const technology = z.strictObject({
    name: text(1, 100),
    category: z.enum(e.technology_category).default("other"),
    version: optText(50),
    notes: optText(1000),
    repo: key.nullish(),
  })
  const environment = z.strictObject({
    key,
    name: text(1, 100),
    environment_type: z.enum(e.environment_type),
    status: z.enum(e.environment_status).default("active"),
    machine_label: optText(100),
    application_url: httpUrl,
    api_url: httpUrl,
    deployment_provider: optText(100),
    server_hostname: pattern(SERVER_HOSTNAME, "hostname or IP only (no scheme, path or user)", 255),
    operating_system: optText(100),
    runtime_versions: z
      .record(z.string().min(1).max(50), z.string().min(1).max(50))
      .default({})
      .refine((v) => JSON.stringify(v).length <= 2048, "runtime_versions too large"),
    deployment_branch: branch,
    deployment_method: optText(2000),
    notes: optText(20000),
    /** Status for variables given by name only (default unknown). */
    variable_status: z.enum(e.configuration_status).default("unknown"),
    variables: z.array(variable).default([]),
  })
  const instance = z.strictObject({
    env: key,
    status: z.enum(e.service_instance_status).default("unknown"),
    resource_name: optText(200),
    region: optText(100),
    endpoint_hostname: pattern(ENDPOINT_HOSTNAME, "endpoint: no spaces or @", 255),
    version_or_plan: optText(100),
    related_variables: z.array(variableName).max(20, "at most 20 related variables").default([]),
    notes: optText(10000),
  })
  const service = z.strictObject({
    key,
    name: text(1, 120),
    category: z.enum(e.service_category).default("other"),
    provider: optText(120),
    purpose: optText(500),
    dashboard_url: httpUrl,
    documentation_url: httpUrl,
    notes: optText(10000),
    instances: z.array(instance).default([]),
  })
  const task = z.strictObject({
    title: text(1, 300),
    description: optText(50000),
    status: z
      .enum(e.task_status)
      .refine(
        (s) => s !== "done" && s !== "blocked",
        "import tasks as inbox, ready, in_progress or review",
      )
      .default("ready"),
    priority: z.enum(e.priority_level).default("medium"),
    next_action: optText(1000),
    repo: key.nullish(),
  })
  const document = z
    .strictObject({
      title: text(1, 300),
      category: z.enum(e.doc_category).default("general"),
      summary: optText(500),
      repo: key.nullish(),
      env: key.nullish(),
      file: z.string().min(1).optional(),
      content: z.string().optional(),
    })
    .refine(
      (d) => (d.file === undefined) !== (d.content === undefined),
      "give either file or content",
    )
  const command = z.strictObject({
    title: text(1, 300),
    command: z
      .string()
      .transform((v) => v.replace(/\s+$/, ""))
      .refine((v) => v.trim().length >= 1 && v.length <= 10000, "command: 1–10000 characters"),
    description: optText(2000),
    prerequisites: optText(2000),
    shell: z.enum(e.command_shell).default("bash"),
    os: z.enum(e.command_os).default("cross_platform"),
    category: z.enum(e.command_category).default("other"),
    destructive: z.boolean().default(false),
    repo: key.nullish(),
    env: key.nullish(),
  })
  const project = z.strictObject({
    key,
    name: text(1, 120),
    project_type: z.enum(e.project_type),
    status: z.enum(e.project_status).default("active"),
    priority: z
      .enum(e.priority_level)
      .nullish()
      .transform((v) => v ?? null),
    description: optText(20000),
    notes: optText(5000),
    start_date: pattern(DATE, "date: YYYY-MM-DD", 10),
    target_date: pattern(DATE, "date: YYYY-MM-DD", 10),
    project_url: httpUrl,
    documentation_url: httpUrl,
    repositories: z.array(repository).default([]),
    technologies: z.array(technology).default([]),
    environments: z.array(environment).default([]),
    services: z.array(service).default([]),
    tasks: z.array(task).default([]),
    documents: z.array(document).default([]),
    commands: z.array(command).default([]),
  })
  return z.strictObject({ version: z.literal(1), projects: z.array(project).min(1) })
}

type ParsedFile = z.output<ReturnType<typeof buildSchema>>
type ParsedProject = ParsedFile["projects"][number]

/** Names that hold credentials or connection strings. Public client keys are not sensitive. */
export function looksSensitive(name: string) {
  const n = name.toUpperCase()
  if (/PUBLISHABLE/.test(n)) return false
  if (/^(NEXT_PUBLIC_|VITE_)/.test(n) && !/SECRET/.test(n)) return false
  return (
    /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|DSN|CREDENTIAL|API_KEY|ACCESS_KEY|AUTH_KEY|APP_KEY|_SALT$)/.test(
      n,
    ) ||
    /(^|_)(DATABASE|DIRECT_DATABASE|DB|REDIS|MONGO|MONGODB|POSTGRES|MYSQL|CLOUDINARY|AMQP)_URL$/.test(
      n,
    ) ||
    /(^|_)KEY(_ID)?$/.test(n)
  )
}

/* Prepared rows -------------------------------------------------------------------------------- */

type Linked<R> = { row: R; repo?: string | null; env?: string | null }

export type PreparedProject = {
  key: string
  name: string
  project: Row<"projects">
  repositories: { key: string; row: Omit<Row<"repositories">, "project_id"> }[]
  technologies: Linked<Omit<Row<"project_technologies">, "project_id" | "repository_id">>[]
  environments: {
    key: string
    row: Omit<Row<"environments">, "project_id">
  }[]
  variables: {
    env: string
    row: Omit<Row<"environment_variables">, "project_id" | "environment_id">
  }[]
  services: { key: string; row: Omit<Row<"project_services">, "project_id"> }[]
  instances: {
    service: string
    env: string
    row: Omit<Row<"service_instances">, "project_id" | "project_service_id" | "environment_id">
  }[]
  tasks: Linked<Omit<Row<"tasks">, "project_id" | "repository_id">>[]
  documents: (Linked<Omit<Row<"documents">, "project_id" | "repository_id" | "environment_id">> & {
    source: string
  })[]
  commands: Linked<
    Omit<Row<"command_snippets">, "project_id" | "repository_id" | "environment_id">
  >[]
  counts: Counts
}

export type Counts = {
  repositories: number
  technologies: number
  environments: number
  variables: number
  services: number
  instances: number
  tasks: number
  documents: number
  commands: number
}

export type PrepareResult =
  | { ok: true; projects: PreparedProject[]; warnings: Issue[] }
  | { ok: false; issues: Issue[]; warnings: Issue[] }

function zodIssues(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    path: i.path.length ? i.path.join(".") : "(file)",
    rule: i.message,
  }))
}

/** Walks every string in the parsed data and reports secret-looking ones by path and kind. */
function screenStrings(
  value: unknown,
  path: string,
  findSecrets: PrepareDeps["findSecrets"],
  out: Issue[],
) {
  if (typeof value === "string") {
    for (const f of findSecrets(value)) out.push({ path, rule: `secret: ${f.kind}` })
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => screenStrings(v, `${path}.${i}`, findSecrets, out))
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value))
      screenStrings(v, path ? `${path}.${k}` : k, findSecrets, out)
  }
}

function duplicates(values: string[]) {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const v of values) (seen.has(v) ? dup : seen).add(v)
  return [...dup]
}

/**
 * Validates and screens the whole file, reads document files, and returns complete rows (every
 * insertable column, defaults filled in). Never returns matched secret text.
 */
export async function prepareImport(data: unknown, deps: PrepareDeps): Promise<PrepareResult> {
  const warnings: Issue[] = []
  const parsed = buildSchema(deps.enums).safeParse(data)
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error), warnings }

  const issues: Issue[] = []
  screenStrings(parsed.data, "", deps.findSecrets, issues)

  const projectNames = parsed.data.projects.map((p) => p.name.toLowerCase())
  for (const d of duplicates(projectNames))
    issues.push({ path: "projects", rule: `duplicate project name "${d}"` })
  for (const d of duplicates(parsed.data.projects.map((p) => p.key)))
    issues.push({ path: "projects", rule: `duplicate project key "${d}"` })

  const prepared: PreparedProject[] = []
  for (const [pi, p] of parsed.data.projects.entries()) {
    const at = `projects.${pi}`
    prepared.push(await prepareProject(p, at, deps, issues, warnings))
  }
  if (issues.length) return { ok: false, issues, warnings }
  return { ok: true, projects: prepared, warnings }
}

async function prepareProject(
  p: ParsedProject,
  at: string,
  deps: PrepareDeps,
  issues: Issue[],
  warnings: Issue[],
): Promise<PreparedProject> {
  const repoKeys = new Set(p.repositories.map((r) => r.key))
  const envKeys = new Set(p.environments.map((e) => e.key))
  const check = (cond: boolean, path: string, rule: string) => {
    if (!cond) issues.push({ path, rule })
  }
  const refRepo = (k: string | null | undefined, path: string) =>
    check(!k || repoKeys.has(k), path, `unknown repository key "${k}"`)
  const refEnv = (k: string | null | undefined, path: string) =>
    check(!k || envKeys.has(k), path, `unknown environment key "${k}"`)

  for (const [kind, list] of [
    ["repository", p.repositories],
    ["environment", p.environments],
    ["service", p.services],
  ] as const) {
    for (const d of duplicates(list.map((x) => x.key)))
      issues.push({ path: at, rule: `duplicate ${kind} key "${d}"` })
    for (const d of duplicates(list.map((x) => x.name.toLowerCase())))
      issues.push({ path: at, rule: `duplicate ${kind} name "${d}"` })
  }
  for (const d of duplicates(p.technologies.map((t) => `${t.name.toLowerCase()}|${t.repo ?? ""}`)))
    issues.push({ path: `${at}.technologies`, rule: `duplicate technology "${d.split("|")[0]}"` })
  if (p.start_date && p.target_date && p.target_date < p.start_date)
    issues.push({ path: at, rule: "target_date is before start_date" })

  p.technologies.forEach((t, i) => refRepo(t.repo, `${at}.technologies.${i}.repo`))
  p.tasks.forEach((t, i) => refRepo(t.repo, `${at}.tasks.${i}.repo`))
  p.commands.forEach((c, i) => {
    refRepo(c.repo, `${at}.commands.${i}.repo`)
    refEnv(c.env, `${at}.commands.${i}.env`)
  })
  p.documents.forEach((d, i) => {
    refRepo(d.repo, `${at}.documents.${i}.repo`)
    refEnv(d.env, `${at}.documents.${i}.env`)
  })

  // Variables: names only, always "imported".
  const variables: PreparedProject["variables"] = []
  const envVariableNames = new Map<string, Set<string>>()
  for (const [ei, e] of p.environments.entries()) {
    const names = new Set<string>()
    const lower = new Set<string>()
    for (const [vi, v] of e.variables.entries()) {
      const item = typeof v === "string" ? { name: v } : v
      const path = `${at}.environments.${ei}.variables.${vi}`
      if (names.has(item.name)) issues.push({ path, rule: `duplicate variable "${item.name}"` })
      else if (lower.has(item.name.toLowerCase()))
        warnings.push({ path, rule: `"${item.name}" differs from another variable only by case` })
      names.add(item.name)
      lower.add(item.name.toLowerCase())
      variables.push({
        env: e.key,
        row: {
          name: item.name,
          is_required: "required" in item && item.required !== undefined ? item.required : true,
          is_sensitive:
            "sensitive" in item && item.sensitive !== undefined
              ? item.sensitive
              : looksSensitive(item.name),
          configuration_status: ("status" in item && item.status) || e.variable_status,
          verification_method: "imported",
          notes: ("notes" in item && item.notes) || null,
          secret_reference_id: null,
        },
      })
    }
    envVariableNames.set(e.key, names)
  }

  const instances: PreparedProject["instances"] = []
  for (const [si, s] of p.services.entries()) {
    const seen = new Set<string>()
    for (const [ii, inst] of s.instances.entries()) {
      const path = `${at}.services.${si}.instances.${ii}`
      refEnv(inst.env, `${path}.env`)
      if (seen.has(inst.env))
        issues.push({ path, rule: `service "${s.name}" listed twice for "${inst.env}"` })
      seen.add(inst.env)
      for (const name of inst.related_variables) {
        if (!envVariableNames.get(inst.env)?.has(name))
          warnings.push({ path, rule: `related variable ${name} isn't defined in "${inst.env}"` })
      }
      instances.push({
        service: s.key,
        env: inst.env,
        row: {
          resource_name: inst.resource_name,
          region: inst.region,
          endpoint_hostname: inst.endpoint_hostname,
          version_or_plan: inst.version_or_plan,
          status: inst.status,
          related_variables: inst.related_variables,
          notes: inst.notes,
        },
      })
    }
  }

  // Documents: read files, strip a BOM, check size, screen every line.
  const documents: PreparedProject["documents"] = []
  for (const [di, d] of p.documents.entries()) {
    const path = `${at}.documents.${di}`
    let content = d.content ?? ""
    let source = "inline"
    if (d.file !== undefined) {
      const abs = isAbsolute(d.file) ? d.file : resolve(deps.baseDir, d.file)
      source = d.file
      try {
        content = (await deps.readFile(abs)).replace(/^﻿/, "")
      } catch {
        issues.push({ path, rule: `can't read file ${d.file}` })
        continue
      }
      content.split(/\r?\n/).forEach((line, li) => {
        for (const f of deps.findSecrets(line))
          issues.push({ path: `${d.file}:${li + 1}`, rule: `secret: ${f.kind}` })
      })
    }
    if (content.length > 100_000) issues.push({ path, rule: "document is over 100,000 characters" })
    documents.push({
      repo: d.repo ?? null,
      env: d.env ?? null,
      source,
      row: { title: d.title, category: d.category, summary: d.summary, content_markdown: content },
    })
  }

  const prepared: PreparedProject = {
    key: p.key,
    name: p.name,
    project: {
      name: p.name,
      description: p.description,
      project_type: p.project_type,
      status: p.status,
      priority: p.priority,
      start_date: p.start_date,
      target_date: p.target_date,
      project_url: p.project_url,
      documentation_url: p.documentation_url,
      notes: p.notes,
    },
    repositories: p.repositories.map((r) => ({
      key: r.key,
      row: {
        name: r.name,
        provider: r.provider,
        remote_url: r.remote_url,
        purpose: r.purpose,
        default_branch: r.default_branch,
        primary_language: r.primary_language,
        local_path: r.local_path,
        readme_url: r.readme_url,
        notes: r.notes,
      },
    })),
    technologies: p.technologies.map((t) => ({
      repo: t.repo ?? null,
      row: { name: t.name, category: t.category, version: t.version, notes: t.notes },
    })),
    environments: p.environments.map((e) => ({
      key: e.key,
      row: {
        name: e.name,
        environment_type: e.environment_type,
        machine_label: e.machine_label,
        application_url: e.application_url,
        api_url: e.api_url,
        deployment_provider: e.deployment_provider,
        server_hostname: e.server_hostname,
        operating_system: e.operating_system,
        runtime_versions: e.runtime_versions,
        deployment_branch: e.deployment_branch,
        deployment_method: e.deployment_method,
        status: e.status,
        notes: e.notes,
      },
    })),
    variables,
    services: p.services.map((s) => ({
      key: s.key,
      row: {
        name: s.name,
        category: s.category,
        provider: s.provider,
        purpose: s.purpose,
        dashboard_url: s.dashboard_url,
        documentation_url: s.documentation_url,
        notes: s.notes,
      },
    })),
    instances,
    tasks: p.tasks.map((t, i) => ({
      repo: t.repo ?? null,
      row: {
        parent_task_id: null,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        next_action: t.next_action,
        blocker_details: null,
        due_at: null,
        external_reference_url: null,
        sort_order: i,
      },
    })),
    documents,
    commands: p.commands.map((c) => ({
      repo: c.repo ?? null,
      env: c.env ?? null,
      row: {
        title: c.title,
        command_text: c.command,
        description: c.description,
        shell: c.shell,
        operating_system: c.os,
        category: c.category,
        prerequisites: c.prerequisites,
        is_destructive: c.destructive,
      },
    })),
    counts: {
      repositories: p.repositories.length,
      technologies: p.technologies.length,
      environments: p.environments.length,
      variables: variables.length,
      services: p.services.length,
      instances: instances.length,
      tasks: p.tasks.length,
      documents: p.documents.length,
      commands: p.commands.length,
    },
  }
  return prepared
}

/* Import ----------------------------------------------------------------------------------------- */

export type ProjectOutcome = {
  key: string
  name: string
  status: "created" | "skipped" | "failed" | "not_attempted"
  counts?: Counts
  stage?: string
  code?: string
  message?: string
  rolledBack?: boolean
}

export type ImportReport =
  | { outcome: "invalid"; issues: Issue[]; warnings: Issue[] }
  | { outcome: "cancelled"; warnings: Issue[] }
  | { outcome: "done" | "failed"; warnings: Issue[]; projects: ProjectOutcome[] }

export type ImportDeps = PrepareDeps & {
  log: (line: string) => void
  /** Import only these project keys. */
  only?: string[]
  /** Shown the create and skip lists before anything is written; false cancels. */
  confirm?: (plan: { create: string[]; skip: string[] }) => Promise<boolean>
  signal?: AbortSignal
}

class StageError extends Error {
  stage: string
  code: string
  constructor(stage: string, error: { code?: string; message?: string } | null) {
    super(error?.message ?? "failed")
    this.stage = stage
    this.code = error?.code ?? "error"
  }
}

const COUNT_TABLES: [keyof Counts, ImportTable][] = [
  ["repositories", "repositories"],
  ["technologies", "project_technologies"],
  ["environments", "environments"],
  ["variables", "environment_variables"],
  ["services", "project_services"],
  ["instances", "service_instances"],
  ["tasks", "tasks"],
  ["documents", "documents"],
  ["commands", "command_snippets"],
]

/** What the database now holds for one project (through RLS). */
export async function countProject(
  client: SupabaseClient<Database>,
  projectId: string,
): Promise<Counts> {
  const db = client as unknown as SupabaseClient
  const out = {} as Counts
  for (const [k, table] of COUNT_TABLES) {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
    if (error) throw new StageError(`count ${table}`, error)
    out[k] = count ?? 0
  }
  return out
}

/**
 * Prepares (and refuses on any issue), confirms, then inserts project by project. A project that
 * fails part-way is deleted again (the foreign keys cascade) and the run stops there.
 */
export async function importWorkspace(
  client: SupabaseClient<Database>,
  data: unknown,
  deps: ImportDeps,
): Promise<ImportReport> {
  const prep = await prepareImport(data, deps)
  if (!prep.ok) return { outcome: "invalid", issues: prep.issues, warnings: prep.warnings }
  const selected = deps.only?.length
    ? prep.projects.filter((p) => deps.only!.includes(p.key))
    : prep.projects

  const db = client as unknown as SupabaseClient
  const { data: existing, error: existingError } = await db.from("projects").select("id, name")
  if (existingError) throw new StageError("load projects", existingError)
  const existingIds = new Set((existing ?? []).map((p: { id: string }) => p.id))
  const taken = new Set((existing ?? []).map((p: { name: string }) => p.name.trim().toLowerCase()))
  const create = selected.filter((p) => !taken.has(p.name.toLowerCase()))
  const skip = selected.filter((p) => taken.has(p.name.toLowerCase()))
  if (
    deps.confirm &&
    !(await deps.confirm({ create: create.map((p) => p.name), skip: skip.map((p) => p.name) }))
  )
    return { outcome: "cancelled", warnings: prep.warnings }

  const results: ProjectOutcome[] = skip.map((p) => ({
    key: p.key,
    name: p.name,
    status: "skipped",
  }))
  let failed = false
  for (const p of create) {
    if (failed) {
      results.push({ key: p.key, name: p.name, status: "not_attempted" })
      continue
    }
    deps.log(`Creating ${p.name}…`)
    const created: { id: string | null } = { id: null }
    try {
      await insertProject(db, p, deps, (id) => {
        created.id = id
      })
      const counts = await countProject(client, created.id!)
      for (const [k] of COUNT_TABLES) {
        if (counts[k] !== p.counts[k])
          throw new StageError("verify counts", {
            code: "count_mismatch",
            message: `${k}: ${counts[k]} of ${p.counts[k]}`,
          })
      }
      results.push({ key: p.key, name: p.name, status: "created", counts })
      deps.log(`  done`)
    } catch (e) {
      failed = true
      const err =
        e instanceof StageError ? e : new StageError("unknown", { message: (e as Error).message })
      deps.log(`  failed at ${err.stage} (${err.code}); rolling back`)
      const rolledBack = await rollback(db, p.name, created.id, existingIds)
      results.push({
        key: p.key,
        name: p.name,
        status: "failed",
        stage: err.stage,
        code: err.code,
        message: err.message,
        rolledBack,
      })
    }
  }
  return { outcome: failed ? "failed" : "done", warnings: prep.warnings, projects: results }
}

async function insertProject(
  db: SupabaseClient,
  p: PreparedProject,
  deps: ImportDeps,
  onProjectId: (id: string) => void,
): Promise<void> {
  const step = (stage: string) => {
    if (deps.signal?.aborted) throw new StageError(stage, { code: "aborted", message: "aborted" })
  }
  const one = async (table: ImportTable, row: object) => {
    step(table)
    const { data, error } = await db
      .from(table)
      .insert(row, { defaultToNull: false })
      .select("id")
      .single()
    if (error || !data) throw new StageError(table, error)
    return (data as { id: string }).id
  }
  const many = async (table: ImportTable, rows: object[], select?: string) => {
    step(table)
    if (!rows.length) return [] as { id: string; name: string }[]
    const q = db.from(table).insert(rows, { defaultToNull: false })
    const { data, error } = select ? await q.select(select) : await q
    if (error) throw new StageError(table, error)
    return (data ?? []) as unknown as { id: string; name: string }[]
  }
  const byName = (rows: { id: string; name: string }[]) =>
    new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.id]))

  const projectId = await one("projects", p.project)
  onProjectId(projectId)
  const repoIds = byName(
    await many(
      "repositories",
      p.repositories.map((r) => ({ project_id: projectId, ...r.row })),
      "id, name",
    ),
  )
  const repoId = (k: string | null | undefined) => {
    if (!k) return null
    const name = p.repositories.find((r) => r.key === k)!.row.name
    return repoIds.get(name.toLowerCase()) ?? null
  }
  await many(
    "project_technologies",
    p.technologies.map((t) => ({ project_id: projectId, repository_id: repoId(t.repo), ...t.row })),
  )
  const envIds = byName(
    await many(
      "environments",
      p.environments.map((e) => ({ project_id: projectId, ...e.row })),
      "id, name",
    ),
  )
  const envId = (k: string | null | undefined) => {
    if (!k) return null
    const name = p.environments.find((e) => e.key === k)!.row.name
    return envIds.get(name.toLowerCase()) ?? null
  }
  await many(
    "environment_variables",
    p.variables.map((v) => ({ project_id: projectId, environment_id: envId(v.env), ...v.row })),
  )
  const serviceIds = byName(
    await many(
      "project_services",
      p.services.map((s) => ({ project_id: projectId, ...s.row })),
      "id, name",
    ),
  )
  const serviceId = (k: string) => {
    const name = p.services.find((s) => s.key === k)!.row.name
    return serviceIds.get(name.toLowerCase())!
  }
  await many(
    "service_instances",
    p.instances.map((i) => ({
      project_id: projectId,
      project_service_id: serviceId(i.service),
      environment_id: envId(i.env),
      ...i.row,
    })),
  )
  await many(
    "tasks",
    p.tasks.map((t) => ({ project_id: projectId, repository_id: repoId(t.repo), ...t.row })),
  )
  for (const d of p.documents) {
    await one("documents", {
      project_id: projectId,
      repository_id: repoId(d.repo),
      environment_id: envId(d.env),
      ...d.row,
    })
  }
  await many(
    "command_snippets",
    p.commands.map((c) => ({
      project_id: projectId,
      repository_id: repoId(c.repo),
      environment_id: envId(c.env),
      ...c.row,
    })),
  )
}

/** Deletes a partly created project (children cascade). Returns whether it is gone. */
async function rollback(
  db: SupabaseClient,
  name: string,
  projectId: string | null,
  existingIds: Set<string>,
): Promise<boolean> {
  let ids = projectId ? [projectId] : []
  if (!projectId) {
    const { data } = await db.from("projects").select("id, name").eq("name", name)
    ids = (data ?? []).map((r: { id: string }) => r.id).filter((id: string) => !existingIds.has(id))
  }
  for (const id of ids) await db.from("projects").delete().eq("id", id)
  if (!ids.length) return true
  const { data } = await db.from("projects").select("id").in("id", ids)
  return (data ?? []).length === 0
}
