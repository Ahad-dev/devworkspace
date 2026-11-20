import { Suspense } from "react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ActiveSessionServer } from "@/features/sessions/components/active-session-server"
import { AppBreadcrumbs } from "./app-breadcrumbs"
import { CommandMenu } from "./command-menu"
import { QuickCreateMenu } from "./quick-create-menu"
import { ThemeToggle } from "./theme-toggle"
import { UserMenuServer } from "./user-menu-server"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      {/* Reads the URL: runtime data on dynamic routes. */}
      {/* Gives way first on narrow screens (the session timer and actions keep their size). */}
      <div className="min-w-0 overflow-hidden whitespace-nowrap">
        <Suspense fallback={null}>
          <AppBreadcrumbs />
        </Suspense>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Running work session (Spec FR-07): streams in; absent when nothing is running. */}
        <Suspense fallback={null}>
          <ActiveSessionServer />
        </Suspense>
        <CommandMenu />
        <QuickCreateMenu />
        {/* Also under Settings → Appearance; hidden on phones to keep the header on one line. */}
        <div className="hidden sm:flex">
          <ThemeToggle />
        </div>
        {/* Session read: streams in so the rest of the shell stays in the static shell. */}
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <UserMenuServer />
        </Suspense>
      </div>
    </header>
  )
}
