"use client"

import * as React from "react"
import { BookOpen, FolderPlus, ListPlus, Plus, Server, Timer } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog"

/**
 * Quick-create (Spec §3.1, FR-02). Each entry is wired up in the phase that builds its feature;
 * until then it is shown disabled with the phase it arrives in.
 */
const LATER = [
  { label: "Task", icon: ListPlus, phase: "P3" },
  { label: "Work session", icon: Timer, phase: "P4" },
  { label: "Environment", icon: Server, phase: "P5" },
  { label: "Document", icon: BookOpen, phase: "P6" },
] as const

export function QuickCreateMenu() {
  const [projectOpen, setProjectOpen] = React.useState(false)
  // Remount the dialog per open so a previous error doesn't linger.
  const [projectKey, setProjectKey] = React.useState(0)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" aria-label="Create new">
            <Plus />
            <span className="hidden sm:inline">New</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Create</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setProjectKey((k) => k + 1)
              setProjectOpen(true)
            }}
          >
            <FolderPlus />
            Project
          </DropdownMenuItem>
          {LATER.map((item) => (
            <DropdownMenuItem key={item.label} disabled>
              <item.icon />
              {item.label}
              <DropdownMenuShortcut>{item.phase}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateProjectDialog key={projectKey} open={projectOpen} onOpenChange={setProjectOpen} />
    </>
  )
}
