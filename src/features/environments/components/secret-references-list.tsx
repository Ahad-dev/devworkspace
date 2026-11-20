"use client"

import * as React from "react"
import { ExternalLink, KeyRound, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { deleteSecretReference } from "../actions"
import type { SecretReferenceRow } from "../queries"
import { SecretReferenceDialog } from "./secret-reference-dialog"

/** All secret references (owner-level, reused across environments). Locators only. */
export function SecretReferencesList({
  references,
  usage,
}: {
  references: SecretReferenceRow[]
  /** How many variables point at each reference. */
  usage: Record<string, number>
}) {
  const [editing, setEditing] = React.useState<SecretReferenceRow | "new" | null>(null)
  const [key, setKey] = React.useState(0)
  const [pending, startTransition] = React.useTransition()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Where secrets live in your vault. Variables link to these instead of holding values.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setKey((k) => k + 1)
            setEditing("new")
          }}
        >
          <Plus />
          New reference
        </Button>
      </div>
      {references.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No secret references yet. Add one when a sensitive variable has a home in Infisical,
          Doppler, 1Password or another vault.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {references.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
            >
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-medium">{r.provider}</span>
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                {[r.vault_project_or_workspace, r.vault_path_or_item_id, r.key_name]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
              <span className="text-xs text-muted-foreground">
                {usage[r.id] ?? 0} variable{(usage[r.id] ?? 0) === 1 ? "" : "s"}
              </span>
              <span className="ml-auto flex items-center gap-1">
                {r.vault_url ? (
                  <a
                    href={r.vault_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${r.provider} in a new tab`}
                    className="inline-flex size-6 items-center justify-center rounded-md hover:bg-muted"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Edit reference"
                  onClick={() => {
                    setKey((k) => k + 1)
                    setEditing(r)
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Remove reference"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const n = usage[r.id] ?? 0
                      if (
                        n &&
                        !window.confirm(`${n} variable(s) use this reference. Remove it anyway?`)
                      )
                        return
                      const res = await deleteSecretReference(r.id)
                      if (res.ok) toast.success("Reference removed")
                      else toast.error(res.error)
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <SecretReferenceDialog
          key={key}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          reference={editing === "new" ? undefined : editing}
        />
      ) : null}
    </div>
  )
}
