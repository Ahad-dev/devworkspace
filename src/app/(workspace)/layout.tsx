import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

/**
 * Workspace shell. With Cache Components on, this layout stays static: session-dependent
 * UI (user menu, active session) must render inside its own <Suspense> boundary, never as a
 * top-level await here. See docs/IMPLEMENTATION_PLAN.md §5.
 */
export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar />
      {/* min-w-0: wide content (task tables, the board) scrolls inside the page, not the page. */}
      <SidebarInset className="min-w-0">
        <AppHeader />
        <main id="main" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
