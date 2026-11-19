import { z } from "zod"

import {
  EDITABLE_PROJECT_STATUSES,
  PRIORITIES,
  PROJECT_TYPES,
  REPOSITORY_PROVIDERS,
  REPOSITORY_PURPOSES,
  TECHNOLOGY_CATEGORIES,
} from "@/lib/constants/domain"
import { secretMessage } from "@/lib/security/secret-guard"

/**
 * Form schemas for projects, repositories and technologies. The database enforces the same rules
 * (check constraints, http_url domain, composite FKs); these give fast, friendly feedback first.
 */

/** Trimmed text; empty becomes null. Rejects anything that looks like a secret. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .superRefine((v, ctx) => {
      const msg = secretMessage(v)
      if (msg) ctx.addIssue({ code: "custom", message: msg })
    })
}

/** http(s) URL without credentials (mirrors the public.http_url domain); empty becomes null. */
export const optionalUrl = z
  .string()
  .trim()
  .max(2048, "Use at most 2048 characters")
  .transform((v) => (v === "" ? null : v))
  .superRefine((v, ctx) => {
    if (v === null) return
    if (!/^https?:\/\/[^\s/?#@]+([/?#]\S*)?$/.test(v)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter an http(s) URL without a username or password",
      })
      return
    }
    const msg = secretMessage(v)
    if (msg) ctx.addIssue({ code: "custom", message: msg })
  })

/** Git remote: https without credentials, git@host:path, or ssh://[user@]host[:port]/path. */
export const optionalGitRemote = z
  .string()
  .trim()
  .max(1000, "Use at most 1000 characters")
  .transform((v) => (v === "" ? null : v))
  .superRefine((v, ctx) => {
    if (v === null) return
    const ok =
      /^https:\/\/[^\s/?#@]+\/[^\s?#]+$/.test(v) ||
      /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:\S+$/.test(v) ||
      /^ssh:\/\/([A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+(:\d+)?\/\S+$/.test(v)
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        message:
          "Use https://host/owner/repo (no credentials), git@host:owner/repo.git, or ssh://host/path",
      })
    }
  })

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date")

const name = (max: number) =>
  z.string().trim().min(1, "Enter a name").max(max, `Use at most ${max} characters`)

/* Projects ---------------------------------------------------------------- */

export const projectCreateSchema = z.object({
  name: name(120),
  project_type: z.enum(PROJECT_TYPES, "Choose a project type"),
})

export const projectUpdateSchema = z
  .object({
    name: name(120),
    project_type: z.enum(PROJECT_TYPES, "Choose a project type"),
    // Omitted for archived projects: archive/restore are separate actions.
    status: z
      .enum(EDITABLE_PROJECT_STATUSES as [string, ...string[]], "Choose a status")
      .optional(),
    priority: z.union([z.enum(PRIORITIES), z.literal("")]).transform((v) => (v === "" ? null : v)),
    description: optionalText(20000),
    start_date: optionalDate,
    target_date: optionalDate,
    project_url: optionalUrl,
    documentation_url: optionalUrl,
    notes: optionalText(5000),
  })
  .refine((v) => !v.start_date || !v.target_date || v.target_date >= v.start_date, {
    message: "Target date can't be before the start date",
    path: ["target_date"],
  })

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>

/* Repositories ------------------------------------------------------------ */

export const repositorySchema = z.object({
  name: name(200),
  provider: z.enum(REPOSITORY_PROVIDERS, "Choose a provider"),
  purpose: z.enum(REPOSITORY_PURPOSES, "Choose a purpose"),
  remote_url: optionalGitRemote,
  default_branch: z
    .string()
    .trim()
    .max(255)
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || !/\s/.test(v), "Branch names can't contain spaces"),
  primary_language: optionalText(100),
  local_path: optionalText(1000),
  readme_url: optionalUrl,
  notes: optionalText(5000),
})

export type RepositoryInput = z.infer<typeof repositorySchema>

/* Technologies ------------------------------------------------------------ */

export const technologySchema = z.object({
  name: name(100),
  category: z.enum(TECHNOLOGY_CATEGORIES, "Choose a category"),
  version: optionalText(50),
  repository_id: z.union([z.uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
})

export type TechnologyInput = z.infer<typeof technologySchema>

/* Shared form state --------------------------------------------------------- */

export type FormState<T = unknown> = {
  status: "idle" | "error" | "success"
  message?: string
  fieldErrors?: Partial<Record<string, string[]>>
  data?: T
}

export const initialFormState: FormState = { status: "idle" }
