import {
  BookOpen,
  Boxes,
  FolderKanban,
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

/** Main navigation, grouped by work rather than by table (Spec §3.1). */
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
    label: "Engineering Knowledge",
    items: [
      { title: "Environments", href: "/environments", icon: Server },
      { title: "Knowledge Base", href: "/knowledge", icon: BookOpen },
      { title: "Services", href: "/services", icon: Boxes },
    ],
  },
]

export const PERSONAL_NAV: NavGroup = {
  label: "Personal",
  items: [{ title: "Settings", href: "/settings", icon: Settings }],
}

export const ALL_NAV_GROUPS: NavGroup[] = [...NAV_GROUPS, PERSONAL_NAV]

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Routes that live outside the nav but belong to a section (task pages → My Work). */
const SECTION_ALIASES: [string, string][] = [
  ["/tasks", "/my-work"],
  ["/activity", "/dashboard"],
]

/** The group and item that own the current path, for breadcrumbs. */
export function findNavMatch(pathname: string) {
  for (const [prefix, target] of SECTION_ALIASES) {
    if (isActivePath(pathname, prefix)) pathname = target
  }
  for (const group of ALL_NAV_GROUPS) {
    const item = group.items.find((i) => isActivePath(pathname, i.href))
    if (item) return { group, item }
  }
  return null
}
