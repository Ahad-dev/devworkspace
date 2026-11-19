"use client"

import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { findNavMatch } from "./nav-config"

/**
 * Section-level breadcrumbs derived from the nav config.
 * Deeper pages (project → tab, task detail) will pass their own trail in later phases.
 */
export function AppBreadcrumbs() {
  const pathname = usePathname()
  const match = findNavMatch(pathname)
  if (!match) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">{match.group.label}</BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{match.item.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
