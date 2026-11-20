import { z } from "zod"

import { optionalText, optionalUrl } from "@/features/projects/schemas"
import { LABEL_COLORS, PRIORITIES, TASK_STATUSES } from "@/lib/constants/domain"
import { secretMessage } from "@/lib/security/secret-guard"

/**
 * Task form schemas (Spec FR-06). The database enforces the same rules (checks, composite FKs,
 * triggers); these give fast, field-level feedback first and keep secrets out of free text.
 */

function requiredText(max: number, empty: string) {
  return z
    .string()
    .trim()
    .min(1, empty)
    .max(max, `Use at most ${max} characters`)
    .superRefine((v, ctx) => {
      const msg = secretMessage(v)
      if (msg) ctx.addIssue({ code: "custom", message: msg })
    })
}

export const taskTitle = requiredText(300, "Enter a title")

const optionalUuid = z
  .union([z.uuid(), z.literal(""), z.literal("none")])
  .transform((v) => (v === "" || v === "none" ? null : v))

/** "YYYY-MM-DD" from a date input; the action turns it into end of day in the user's timezone. */
const dueDate = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), {
    message: "Use a valid date",
  })
  .transform((v) => (v === "" ? null : v))

const blockedNeedsDetails = {
  check: (v: { status: string; blocker_details: string | null }) =>
    v.status !== "blocked" || Boolean(v.blocker_details),
  params: { message: "Say what's blocking this task", path: ["blocker_details"] },
}

/** Quick capture (Plan §9 decision 1): title + project, lands in Inbox. */
export const quickTaskSchema = z.object({
  title: taskTitle,
  project_id: z.uuid("Choose a project"),
})

const taskFields = {
  title: taskTitle,
  status: z.enum(TASK_STATUSES, "Choose a status"),
  priority: z.enum(PRIORITIES, "Choose a priority"),
  description: optionalText(50000),
  next_action: optionalText(1000),
  blocker_details: optionalText(2000),
  due_date: dueDate,
  repository_id: optionalUuid,
  parent_task_id: optionalUuid,
  external_reference_url: optionalUrl,
}

export const taskCreateSchema = z
  .object({ project_id: z.uuid("Choose a project"), ...taskFields })
  .refine(blockedNeedsDetails.check, blockedNeedsDetails.params)

export const taskUpdateSchema = z
  .object(taskFields)
  .refine(blockedNeedsDetails.check, blockedNeedsDetails.params)

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>

export const statusChangeSchema = z
  .object({ status: z.enum(TASK_STATUSES), blocker_details: optionalText(2000) })
  .refine(blockedNeedsDetails.check, blockedNeedsDetails.params)

export const nextActionSchema = z.object({ next_action: optionalText(1000) })

export const commentSchema = z.object({ content: requiredText(10000, "Write a comment first") })

export const linkSchema = z.object({
  label: requiredText(120, "Enter a label"),
  url: optionalUrl.transform((v, ctx) => {
    if (v === null) {
      ctx.addIssue({ code: "custom", message: "Enter a URL" })
      return z.NEVER
    }
    return v
  }),
})

export const labelSchema = z.object({
  name: requiredText(50, "Enter a label name"),
  color: z.enum(LABEL_COLORS, "Choose a colour"),
})

export const subtaskSchema = z.object({ title: taskTitle })
