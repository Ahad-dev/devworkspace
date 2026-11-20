import { z } from "zod"

import { optionalText, optionalUrl } from "@/features/projects/schemas"
import { secretMessage } from "@/lib/security/secret-guard"

/**
 * Handoff and session-detail schemas (Spec FR-07). The RPCs and table checks enforce the same
 * limits; these give field-level feedback first and keep secrets out of handoff text.
 */

const linkLabel = z
  .string()
  .trim()
  .min(1, "Enter a label")
  .max(120, "Use at most 120 characters")
  .superRefine((v, ctx) => {
    const msg = secretMessage(v)
    if (msg) ctx.addIssue({ code: "custom", message: msg })
  })

const linkUrl = optionalUrl.transform((v, ctx) => {
  if (v === null) {
    ctx.addIssue({ code: "custom", message: "Enter a URL" })
    return z.NEVER
  }
  return v
})

export const handoffSchema = z.object({
  completed_summary: optionalText(10000),
  current_state: optionalText(10000),
  remaining_work: optionalText(10000),
  next_action: optionalText(1000),
  blockers: optionalText(2000),
  technical_notes: optionalText(20000),
  related_links: z
    .array(z.object({ label: linkLabel, url: linkUrl }))
    .max(20, "Add at most 20 links"),
})

export type HandoffInput = z.infer<typeof handoffSchema>

export function isEmptyHandoff(h: HandoffInput) {
  return (
    !h.completed_summary &&
    !h.current_state &&
    !h.remaining_work &&
    !h.next_action &&
    !h.blockers &&
    !h.technical_notes &&
    h.related_links.length === 0
  )
}

/** Optional end time for closing a session left running (ISO instant, not in the future). */
export const endedAtSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Use a valid date and time")
  .refine(
    (v) => v === null || Date.parse(v) <= Date.now() + 60_000,
    "The end time can't be in the future",
  )

export const sessionDetailsSchema = z.object({
  branch_name: z
    .string()
    .trim()
    .max(255, "Use at most 255 characters")
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || !/\s/.test(v), "Branch names can't contain spaces"),
  notes: optionalText(10000),
  repository_id: z
    .union([z.uuid(), z.literal(""), z.literal("none")])
    .transform((v) => (v === "" || v === "none" ? null : v)),
})
