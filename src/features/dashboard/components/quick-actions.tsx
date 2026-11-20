"use client"

import * as React from "react"

import {
  QUICK_CREATE,
  QuickCreateDialog,
  quickCreate,
  type QuickCreateRequest,
} from "@/components/layout/quick-create-dialog"
import { Button } from "@/components/ui/button"

/** Dashboard quick actions (Spec FR-02 §7): the same dialogs as the header's New menu. */
export function QuickActions() {
  const [request, setRequest] = React.useState<QuickCreateRequest | null>(null)
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick actions">
      {QUICK_CREATE.map((item) => (
        <Button
          key={item.kind}
          size="sm"
          variant="outline"
          onClick={() => setRequest(quickCreate(item.kind, request))}
        >
          <item.icon />
          {item.kind === "session" ? "Start session" : `New ${item.label.toLowerCase()}`}
        </Button>
      ))}
      {request ? (
        <QuickCreateDialog key={request.n} request={request} onClose={() => setRequest(null)} />
      ) : null}
    </div>
  )
}
