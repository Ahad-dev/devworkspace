import {
  BookOpen,
  Boxes,
  FolderKanban,
  GitCompareArrows,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Server,
  Settings,
  Timer,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

/**
 * Main navigation, grouped by work rather than by table (Spec §3.1). Kept short (Plan P10.6):
 * environments belong to a project, so they are reached from the project, the dashboard and the
 * command palette rather than the sidebar.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { title: "My Work", href: "/my-work", icon: ListTodo },
      { title: "Work Sessions", href: "/sessions", icon: Timer },
    ],
  },
  {
    label: "Projects",
    items: [{ title: "All Projects", href: "/projects", icon: FolderKanban }],
  },
  {
    label: "Reference",
    items: [
      { title: "Knowledge Base", href: "/knowledge", icon: BookOpen },
      { title: "Accounts", href: "/accounts", icon: KeyRound },
    ],
  },
]

export const PERSONAL_NAV: NavGroup = {
  label: "Personal",
  items: [{ title: "Settings", href: "/settings", icon: Settings }],
}

export const ALL_NAV_GROUPS: NavGroup[] = [...NAV_GROUPS, PERSONAL_NAV]

/** Pages the command palette offers that aren't in the sidebar. */
export const PALETTE_EXTRAS: NavGroup = {
  label: "More pages",
  items: [
    { title: "All services", href: "/services", icon: Boxes },
    { title: "All environments", href: "/environments", icon: Server },
    { title: "Compare environments", href: "/environments/compare", icon: GitCompareArrows },
  ],
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Routes that live outside the nav but belong to a section (task pages → My Work). */
const SECTION_ALIASES: [string, string][] = [
  ["/tasks", "/my-work"],
  ["/activity", "/dashboard"],
  ["/environments", "/projects"],
  ["/services", "/accounts"],
]

/** The section a path belongs to, following SECTION_ALIASES. */
export function sectionPath(pathname: string) {
  for (const [prefix, target] of SECTION_ALIASES) {
    if (isActivePath(pathname, prefix)) return target
  }
  return pathname
}

/** The group and item that own the current path, for breadcrumbs and the sidebar highlight. */
export function findNavMatch(pathname: string) {
  const path = sectionPath(pathname)
  for (const group of ALL_NAV_GROUPS) {
    const item = group.items.find((i) => isActivePath(path, i.href))
    if (item) return { group, item }
  }
  return null
}
