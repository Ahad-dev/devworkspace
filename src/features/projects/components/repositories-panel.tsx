"use client"

import * as React from "react"
import { ExternalLink, GitBranch, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { REPOSITORY_PROVIDER_LABELS, REPOSITORY_PURPOSE_LABELS } from "@/lib/constants/domain"
import { deleteRepository } from "../actions"
import { RepositoryDialog, type RepositoryRow } from "./repository-dialog"

/** Browser-openable link for a remote: https as-is; scp-like git@host:path → https://host/path. */
function browsableRemote(remote: string | null) {
  if (!remote) return null
  if (remote.startsWith("https://")) return remote.replace(/\.git$/, "")
  const scp = remote.match(/^[^@\s]+@([^:\s]+):(.+?)(\.git)?$/)
  if (scp) return `https://${scp[1]}/${scp[2]}`
  return null
}

export function RepositoriesPanel({
  projectId,
  repositories,
}: {
  projectId: string
  repositories: RepositoryRow[]
}) {
  const [dialog, setDialog] = React.useState<{ open: boolean; repo?: RepositoryRow }>({
    open: false,
  })
  const [toDelete, setToDelete] = React.useState<RepositoryRow | null>(null)
  const [pending, startTransition] = React.useTransition()
  // Remount the dialog per open so its form state starts fresh.
  const [dialogKey, setDialogKey] = React.useState(0)

  const openDialog = (repo?: RepositoryRow) => {
    setDialogKey((k) => k + 1)
    setDialog({ open: true, repo })
  }
  const onOpenChange = React.useCallback((open: boolean) => setDialog((d) => ({ ...d, open })), [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {repositories.length === 0
            ? "Where this project's code lives."
            : `${repositories.length} repositor${repositories.length === 1 ? "y" : "ies"}`}
        </p>
        <Button size="sm" onClick={() => openDialog()}>
          <Plus />
          Add repository
        </Button>
      </div>

      {repositories.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitBranch />
            </EmptyMedia>
            <EmptyTitle>No repositories yet</EmptyTitle>
            <EmptyDescription>
              Add the frontend, backend or monorepo so tasks and docs can point at the right code.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" variant="outline" onClick={() => openDialog()}>
              <Plus />
              Add repository
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-40">Name</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="min-w-48">Local path</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositories.map((r) => {
                const href = browsableRemote(r.remote_url)
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                        >
                          {r.name}
                          <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : (
                        r.name
                      )}
                    </TableCell>
                    <TableCell>{REPOSITORY_PURPOSE_LABELS[r.purpose]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {REPOSITORY_PROVIDER_LABELS[r.provider]}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.default_branch ?? "-"}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                      {r.local_path ?? "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${r.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openDialog(r)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(r)}>
                            <Trash2 />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <RepositoryDialog
        key={dialogKey}
        projectId={projectId}
        repository={dialog.repo}
        open={dialog.open}
        onOpenChange={onOpenChange}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the repository record from DevWorkspace. Technologies linked to it stay
              in the project&apos;s stack, unlinked. Nothing changes in the actual repository.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const repo = toDelete
                if (!repo) return
                startTransition(async () => {
                  await deleteRepository({ projectId, repositoryId: repo.id })
                  setToDelete(null)
                })
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
