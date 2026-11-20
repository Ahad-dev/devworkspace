import { z } from "zod"

import { optionalText } from "@/features/projects/schemas"
import {
  ATTACHMENT_MAX_BYTES,
  COMMAND_CATEGORIES,
  COMMAND_OSES,
  COMMAND_SHELLS,
  DOC_CATEGORIES,
} from "@/lib/constants/domain"
import { secretMessage } from "@/lib/security/secret-guard"
import { attachmentTypeFor, displayFileName } from "./utils"

/**
 * Document, attachment and command schemas (Spec FR-10, FR-11, §9.3, §9.4). The database repeats
 * these rules (no_secret_text, checks, composite FKs, bucket limits); these give field-level
 * feedback first. Placeholders such as $DATABASE_URL pass; literal secrets don't.
 */

function requiredText(max: number, empty: string, opts: { trim?: boolean } = {}) {
  const base = opts.trim === false ? z.string() : z.string().trim()
  return base
    .refine((v) => v.trim().length > 0, empty)
    .refine((v) => v.length <= max, `Use at most ${max.toLocaleString("en")} characters`)
    .superRefine((v, ctx) => {
      const msg = secretMessage(v)
      if (msg) ctx.addIssue({ code: "custom", message: msg })
    })
}

const optionalUuid = z
  .union([z.uuid(), z.literal(""), z.literal("none")])
  .transform((v) => (v === "" || v === "none" ? null : v))

/** A global item (no project) can't point at a repository or an environment. */
function withProjectLinks<T extends { project_id: string | null }>(v: T) {
  return v.project_id ? v : { ...v, repository_id: null, environment_id: null }
}

/* Documents -------------------------------------------------------------------- */

export const documentCreateSchema = z.object({
  title: requiredText(300, "Enter a title"),
  category: z.enum(DOC_CATEGORIES, "Choose a category"),
  project_id: optionalUuid,
})

export const documentUpdateSchema = z
  .object({
    title: requiredText(300, "Enter a title"),
    category: z.enum(DOC_CATEGORIES, "Choose a category"),
    summary: optionalText(500),
    content_markdown: z
      .string()
      .max(100_000, "Use at most 100,000 characters")
      .superRefine((v, ctx) => {
        const msg = secretMessage(v)
        if (msg) ctx.addIssue({ code: "custom", message: msg })
      }),
    project_id: optionalUuid,
    repository_id: optionalUuid,
    environment_id: optionalUuid,
  })
  .transform(withProjectLinks)

export type DocumentUpdateInput = z.input<typeof documentUpdateSchema>

/* Attachments ------------------------------------------------------------------ */

export const attachmentRequestSchema = z
  .object({
    document_id: z.uuid(),
    file_name: z.string().min(1, "Choose a file").max(1000),
    size_bytes: z
      .number()
      .int()
      .min(1, "This file is empty")
      .max(ATTACHMENT_MAX_BYTES, "Files can be at most 10 MB"),
  })
  .transform((v, ctx) => {
    const mime = attachmentTypeFor(v.file_name)
    if (!mime) {
      ctx.addIssue({
        code: "custom",
        path: ["file_name"],
        message: "Allowed: PDF, PNG, JPEG, WebP, GIF, TXT, LOG, MD, CSV and JSON.",
      })
      return z.NEVER
    }
    const file_name = displayFileName(v.file_name)
    const msg = secretMessage(file_name)
    if (msg) {
      ctx.addIssue({ code: "custom", path: ["file_name"], message: "Rename the file: " + msg })
      return z.NEVER
    }
    return { ...v, file_name, mime_type: mime }
  })

/* Commands --------------------------------------------------------------------- */

export const commandSchema = z
  .object({
    title: requiredText(300, "Enter a title"),
    command_text: requiredText(10_000, "Enter the command", { trim: false }).transform((v) =>
      v.replace(/\s+$/, ""),
    ),
    description: optionalText(2000),
    shell: z.enum(COMMAND_SHELLS, "Choose a shell"),
    operating_system: z.enum(COMMAND_OSES, "Choose an operating system"),
    category: z.enum(COMMAND_CATEGORIES, "Choose a category"),
    prerequisites: optionalText(2000),
    is_destructive: z.boolean(),
    project_id: optionalUuid,
    repository_id: optionalUuid,
    environment_id: optionalUuid,
  })
  .transform(withProjectLinks)
