"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SquareTerminal } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NAV_GROUPS, PERSONAL_NAV, isActivePath, type NavGroup } from "./nav-config"

/** pathname is null while the URL streams in on dynamic routes: links render, just not highlighted. */
function NavGroupMenu({ group, pathname }: { group: NavGroup; pathname: string | null }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const active = pathname !== null && isActivePath(pathname, item.href)
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function ActiveNavGroupMenu({ group }: { group: NavGroup }) {
  return <NavGroupMenu group={group} pathname={usePathname()} />
}

/**
 * The URL is runtime data on dynamic routes (Cache Components), so the part that reads it sits
 * behind Suspense. The rest of the shell stays in the static prerender.
 */
function Nav({ group }: { group: NavGroup }) {
  return (
    <Suspense fallback={<NavGroupMenu group={group} pathname={null} />}>
      <ActiveNavGroupMenu group={group} />
    </Suspense>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="DevWorkspace">
              <Link href="/dashboard">
                <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <SquareTerminal className="size-4" />
                </span>
                <span className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">DevWorkspace</span>
                  <span className="text-xs text-muted-foreground">Personal workspace</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <Nav key={group.label} group={group} />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <Nav group={PERSONAL_NAV} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
