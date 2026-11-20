import { ATTACHMENT_TYPES, type AttachmentMime } from "@/lib/constants/domain"

/**
 * Pure helpers for documents, attachments and commands (Spec FR-10, FR-11, §9.4; Plan P6.2,
 * P6.6). Shared by the browser and the server so both apply the same rules.
 */

/* Attachments ------------------------------------------------------------------ */

function baseName(name: string) {
  return name.split(/[\\/]/).pop() ?? ""
}

/**
 * Storage object name: ASCII letters, digits, dot, dash and underscore only, at most 120
 * characters, extension kept. Never trusts the browser's path or characters.
 */
export function sanitizeFileName(name: string): string {
  const ascii = baseName(name).normalize("NFKD").replace(/\p{M}/gu, "")
  const dot = ascii.lastIndexOf(".")
  const rawBase = dot > 0 ? ascii.slice(0, dot) : ascii
  const rawExt = dot > 0 ? ascii.slice(dot + 1) : ""
  const clean = (s: string) =>
    s
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-._]+|[-._]+$/g, "")
  const ext = clean(rawExt).replace(/\./g, "").slice(0, 10).toLowerCase()
  const base = clean(rawBase).slice(0, 100) || "file"
  return ext ? `${base}.${ext}` : base
}

/** Name shown in the UI: the original base name without control characters. */
export function displayFileName(name: string): string {
  const cleaned = baseName(name)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255)
  return cleaned || "file"
}

/** The MIME type for an allowed extension, or null. Decided by extension, not by the browser. */
export function attachmentTypeFor(name: string): AttachmentMime | null {
  const base = baseName(name)
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return null
  const ext = base.slice(dot + 1).toLowerCase()
  return (ATTACHMENT_TYPES as Record<string, AttachmentMime>)[ext] ?? null
}

/** Text files are read and screened for secrets in the browser before upload. */
export function isTextAttachment(mime: string) {
  return mime.startsWith("text/") || mime === "application/json"
}

export function attachmentStoragePath(
  ownerId: string,
  documentId: string,
  objectId: string,
  fileName: string,
) {
  return `${ownerId}/${documentId}/${objectId}-${sanitizeFileName(fileName)}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/* Commands --------------------------------------------------------------------- */

const DESTRUCTIVE: { re: RegExp; reason: string }[] = [
  { re: /\brm\s+(?:-[a-zA-Z]*[rRf][a-zA-Z]*\s+)+/, reason: "rm -r / -f deletes files" },
  { re: /\bRemove-Item\b[^\n]*-(?:Recurse|Force)\b/i, reason: "Remove-Item -Recurse/-Force" },
  { re: /\b(?:rd|rmdir|del|erase)\s+[^\n]*\/[sSqQ]\b/, reason: "recursive delete in CMD" },
  { re: /\bformat\s+[A-Za-z]:|\bmkfs\b|\bFormat-Volume\b/i, reason: "formats a disk" },
  { re: /\bdd\s+[^\n]*\bof=/, reason: "dd writes raw data to a device" },
  { re: /\bdrop\s+(?:table|database|schema|index|view|user|role)\b/i, reason: "DROP" },
  { re: /\btruncate\s+(?:table\s+)?\w/i, reason: "TRUNCATE" },
  { re: /\bdelete\s+from\b/i, reason: "DELETE FROM" },
  { re: /\b(?:db|migrate|migration)[\s:]+reset\b/i, reason: "resets a database" },
  { re: /\bgit\s+push\b[^\n]*(?:--force\b|\s-f\b|--force-with-lease\b)/, reason: "force push" },
  { re: /\bgit\s+reset\b[^\n]*--hard\b/, reason: "git reset --hard" },
  { re: /\bgit\s+clean\b[^\n]*-[a-zA-Z]*[fdx]/, reason: "git clean deletes untracked files" },
  { re: /\bgit\s+branch\b[^\n]*\s-D\b/, reason: "force-deletes a branch" },
  { re: /\bkubectl\s+delete\b/, reason: "kubectl delete" },
  { re: /\bterraform\s+destroy\b/, reason: "terraform destroy" },
  {
    re: /\bdocker\s+(?:system|volume|image|container)\s+(?:prune|rm)\b|\bdocker\s+rm\b/,
    reason: "removes Docker data",
  },
  { re: /\b(?:FLUSHALL|FLUSHDB)\b/i, reason: "flushes Redis" },
  {
    re: /\bshutdown\b|\bStop-Computer\b|\bRestart-Computer\b|\breboot\b/i,
    reason: "restarts or stops a machine",
  },
  { re: /\bchmod\s+-R\b|\bchown\s+-R\b/, reason: "recursive permission change" },
]

/** Why a command might be destructive (Spec FR-11). A suggestion, never a block. */
export function destructiveReasons(command: string): string[] {
  const reasons: string[] = []
  for (const { re, reason } of DESTRUCTIVE) {
    if (re.test(command) && !reasons.includes(reason)) reasons.push(reason)
  }
  // A bare --force only when nothing more specific explains it.
  if (!reasons.length && /(?:^|\s)--force\b/.test(command)) {
    reasons.push("--force skips safety checks")
  }
  return reasons
}

/* Search ----------------------------------------------------------------------- */

/** Escapes a term for a PostgREST ilike pattern inside an or() filter. */
export function ilikeTerm(q: string) {
  return q
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/[,()"]/g, " ")
    .trim()
}
