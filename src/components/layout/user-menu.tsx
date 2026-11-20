"use client"

import Link from "next/link"
import { LogOut, Settings } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/features/auth/actions"

function initials(displayName: string | null, email: string | null) {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase()
  return (words[0]?.[0] ?? email?.[0] ?? "?").toUpperCase()
}

/** Profile menu. Receives the verified user from UserMenuServer (inside Suspense). */
export function UserMenu({
  email,
  displayName,
}: {
  email: string | null
  displayName: string | null
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The visible initials are part of the name (WCAG 2.5.3, label in name). */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={`Account menu, ${initials(displayName, email)}`}
        >
          <Avatar className="size-7">
            <AvatarFallback className="text-xs font-medium">
              {initials(displayName, email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">
            {displayName ?? email ?? "Unknown account"}
          </div>
          {displayName && email ? (
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
