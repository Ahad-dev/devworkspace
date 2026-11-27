"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Copy, KeyRound, Search, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Row = {
  id: string
  platform: string
  label: string | null
  login_identifier: string | null
  secretCount: number
  projects: string[]
}

/** All accounts, searchable by platform, label or login (Plan P11.4). */
export function AccountsList({ accounts }: { accounts: Row[] }) {
  const [q, setQ] = React.useState("")
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? accounts.filter((a) =>
        [a.platform, a.label ?? "", a.login_identifier ?? "", ...a.projects]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : accounts

  return (
    <div className="flex flex-col gap-3">
      <div className="relative sm:w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search accounts, logins, projects…"
          aria-label="Search accounts"
          className="h-8 pl-8"
        />
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No account matches “{q}”.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Login</TableHead>
                <TableHead className="hidden sm:table-cell">Stored</TableHead>
                <TableHead className="hidden md:table-cell">Used by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      href={`/accounts/${a.id}`}
                      className="inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline"
                    >
                      <UserRound className="size-4 text-muted-foreground" aria-hidden />
                      {a.platform}
                      {a.label ? (
                        <span className="font-normal text-muted-foreground">({a.label})</span>
                      ) : null}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {a.login_identifier ? (
                      <CopyLogin login={a.login_identifier} />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <KeyRound className="size-3.5" aria-hidden />
                      {a.secretCount}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {a.projects.length ? a.projects.join(", ") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/** A login email or username with a copy button (it's not a secret). */
export function CopyLogin({ login }: { login: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span className="truncate font-mono text-xs">{login}</span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Copy login ${login}`}
        onClick={async () => {
          await navigator.clipboard.writeText(login)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </span>
  )
}
