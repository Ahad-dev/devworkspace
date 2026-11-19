import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { AppBreadcrumbs } from "./app-breadcrumbs"
import { CommandMenu } from "./command-menu"
import { QuickCreateMenu } from "./quick-create-menu"
import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <AppBreadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        <CommandMenu />
        <QuickCreateMenu />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
