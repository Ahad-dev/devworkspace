"use client"

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

/**
 * Quick-create (Spec §3.1, FR-02). Each entry is wired up in the phase that builds its feature;
 * until then it is shown disabled with the phase it arrives in.
 */
const ITEMS = [
  { label: "Project", icon: FolderPlus, phase: "P2" },
  { label: "Task", icon: ListPlus, phase: "P3" },
  { label: "Work session", icon: Timer, phase: "P4" },
  { label: "Environment", icon: Server, phase: "P5" },
  { label: "Document", icon: BookOpen, phase: "P6" },
] as const

export function QuickCreateMenu() {
  return (
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
        {ITEMS.map((item) => (
          <DropdownMenuItem key={item.label} disabled>
            <item.icon />
            {item.label}
            <DropdownMenuShortcut>{item.phase}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
