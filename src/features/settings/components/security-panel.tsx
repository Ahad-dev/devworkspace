"use client"

import * as React from "react"
import Link from "next/link"
import { KeyRound, Loader2, LogOut } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { signOutOtherSessions } from "../actions"

/** Security and sessions (Spec §6.11; Plan P8.1). */
export function SecurityPanel({ email }: { email: string | null }) {
  const [pending, startTransition] = React.useTransition()

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        Signed in as <span className="font-medium">{email ?? "your account"}</span>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/update-password"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          <KeyRound />
          Change password
        </Link>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await signOutOtherSessions()
              if (r.ok) toast.success("Signed out of every other browser and device")
              else toast.error(r.error)
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut />}
          Sign out other sessions
        </Button>
      </div>
      <p className="text-muted-foreground">
        Signing out other sessions ends DevWorkspace everywhere except this browser, for example on
        a lost laptop. Running work-session timers keep their recorded time.
      </p>
    </div>
  )
}
