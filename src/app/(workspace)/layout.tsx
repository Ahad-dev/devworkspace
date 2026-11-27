import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { OfflineSync } from "@/features/offline/components/offline-sync"
import { VaultLifecycle } from "@/features/vault/store"

/**
 * Workspace shell. With Cache Components on, this layout stays static: session-dependent
 * UI (user menu, active session) must render inside its own <Suspense> boundary, never as a
 * top-level await here. See docs/IMPLEMENTATION_PLAN.md §5.
 */
export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      {/* First stop for keyboard users: jump past the sidebar and header. */}
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring/50"
      >
        Skip to main content
      </a>
      <AppSidebar />
      {/* min-w-0: wide content (task tables, the board) scrolls inside the page, not the page. */}
      <SidebarInset className="min-w-0">
        <AppHeader />
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          {children}
        </main>
      </SidebarInset>
      {/* Keeps this device's offline copy of tasks fresh (Plan P9.3). Renders nothing. */}
      <OfflineSync />
      {/* Locks the password vault when idle or the page goes away (Plan P11.3). */}
      <VaultLifecycle />
    </SidebarProvider>
  )
}
