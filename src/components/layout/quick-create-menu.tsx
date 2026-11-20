"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  QUICK_CREATE,
  QuickCreateDialog,
  quickCreate,
  type QuickCreateRequest,
} from "./quick-create-dialog"

/** Header quick-create (Spec §3.1, FR-02; Plan P7.3). */
export function QuickCreateMenu() {
  const [request, setRequest] = React.useState<QuickCreateRequest | null>(null)

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
          {QUICK_CREATE.map((item) => (
            <DropdownMenuItem
              key={item.kind}
              onSelect={() => setRequest(quickCreate(item.kind, request))}
            >
              <item.icon />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {request ? (
        <QuickCreateDialog key={request.n} request={request} onClose={() => setRequest(null)} />
      ) : null}
    </>
  )
}
