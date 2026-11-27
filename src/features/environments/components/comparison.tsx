"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, BadgeCheck, KeyRound, LockKeyhole, ShieldAlert } from "lucide-react"

import { EnvironmentBadge } from "@/components/shared/domain-badges"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EnvironmentType } from "@/lib/constants/domain"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ComparisonRow } from "../utils"
import { ConfigurationStatusBadge } from "./env-badges"

type Env = { id: string; name: string; environment_type: EnvironmentType }

/** Project and environment pickers for the comparison (state lives in the URL). */
export function ComparePicker({
  projects,
  projectId,
  environments,
  selected,
}: {
  projects: { id: string; name: string }[]
  projectId: string | null
  environments: Env[]
  selected: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const go = (project: string | null, envs: string[]) => {
    const p = new URLSearchParams()
    if (project) p.set("project", project)
    if (envs.length) p.set("envs", envs.join(","))
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-3">
      <Select value={projectId ?? undefined} onValueChange={(v) => go(v, [])}>
        <SelectTrigger aria-label="Project to compare" className="w-full sm:w-72">
          <SelectValue placeholder="Choose a project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {projectId ? (
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="sr-only">Environments to compare</legend>
          {environments.map((e) => {
            const on = selected.includes(e.id)
            return (
              <div key={e.id} className="flex items-center gap-2">
                <Checkbox
                  id={`cmp-${e.id}`}
                  checked={on}
                  disabled={!on && selected.length >= 6}
                  onCheckedChange={(v) =>
                    go(
                      projectId,
                      v === true
                        ? environments
                            .filter((x) => x.id === e.id || selected.includes(x.id))
                            .map((x) => x.id)
                        : selected.filter((id) => id !== e.id),
                    )
                  }
                />
                <Label htmlFor={`cmp-${e.id}`} className="flex items-center gap-1.5 font-normal">
                  <EnvironmentBadge type={e.environment_type} variant="short" />
                  {e.name}
                </Label>
              </div>
            )
          })}
        </fieldset>
      ) : null}
    </div>
  )
}

const METHOD_SHORT = { manual: "Manual", imported: "Imported", integration: "Verified" } as const

/**
 * Variable matrix (Spec FR-08 comparison; Plan P5.7): presence, required gaps, sensitivity,
 * reference and how each status was established. It never shows values (there are none).
 */
export function ComparisonTable({
  environments,
  rows,
}: {
  environments: Env[]
  rows: ComparisonRow[]
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-48 bg-background">Variable</TableHead>
            {environments.map((e) => (
              <TableHead key={e.id} className="min-w-44">
                <span className="flex items-center gap-1.5">
                  <EnvironmentBadge type={e.environment_type} variant="short" />
                  {e.name}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const requiredSomewhere = Object.values(r.cells).some((c) => c.present && c.required)
            return (
              <TableRow key={r.name} className={cn(r.attention && "bg-status-blocked/5")}>
                <TableCell className="sticky left-0 z-10 bg-background">
                  <span className="flex items-center gap-1.5">
                    {r.attention ? (
                      <AlertTriangle
                        className="size-3.5 shrink-0 text-status-blocked"
                        aria-label="Needs attention"
                      />
                    ) : null}
                    <span className="font-mono text-sm">{r.name}</span>
                    {r.sensitive ? (
                      <ShieldAlert
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="Sensitive"
                      />
                    ) : null}
                  </span>
                </TableCell>
                {environments.map((e) => {
                  const c = r.cells[e.id]
                  if (!c || !c.present) {
                    return (
                      <TableCell key={e.id}>
                        {requiredSomewhere ? (
                          <span className="text-xs font-medium text-status-blocked">
                            Not registered here
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )
                  }
                  return (
                    <TableCell key={e.id}>
                      <div className="flex flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <ConfigurationStatusBadge status={c.status} />
                          {!c.required ? (
                            <span className="text-xs text-muted-foreground">optional</span>
                          ) : null}
                          {c.inVault ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <LockKeyhole className="size-3.5" aria-hidden />
                              In vault
                            </span>
                          ) : c.hasReference ? (
                            <KeyRound
                              className="size-3.5 text-muted-foreground"
                              aria-label="Has a secret reference"
                            />
                          ) : null}
                        </span>
                        {c.status === "configured" || c.status === "missing" ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {c.method === "integration" ? (
                              <BadgeCheck className="size-3 text-status-done" aria-hidden />
                            ) : null}
                            {METHOD_SHORT[c.method]}
                            {c.verifiedAt ? ` · ${formatRelative(c.verifiedAt)}` : ""}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
