"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Loader2, Monitor, Moon, Search, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { quickSearch } from "@/features/search/actions"
import { Highlighted, SEARCH_KIND_ICONS } from "@/features/search/components/search-highlight"
import {
  groupResults,
  metaLabel,
  SEARCH_KIND_LABELS,
  type SearchResult,
} from "@/features/search/utils"
import { ALL_NAV_GROUPS } from "./nav-config"

const noopSubscribe = () => () => {}

const THEMES = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "System theme", icon: Monitor },
] as const

/**
 * Header search trigger + Ctrl/Cmd+K palette (Spec FR-12; Plan P7.5). Typing two or more
 * characters searches the workspace (200 ms debounce, grouped by type, keyboard navigable);
 * pages and the theme stay one keystroke away.
 */
export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState("")
  const latest = React.useRef(0)
  // Hydration-safe platform check: "Ctrl" on the server, the real key once mounted.
  const isMac = React.useSyncExternalStore(
    noopSubscribe,
    () => /mac|iphone|ipad/i.test(navigator.userAgent),
    () => false,
  )
  const router = useRouter()
  const { setTheme } = useTheme()
  const term = q.trim()

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // Debounced search; only the newest request may update the list.
  React.useEffect(() => {
    if (term.length < 2) return
    const id = ++latest.current
    const t = window.setTimeout(async () => {
      setSearching(true)
      const r = await quickSearch(term)
      if (id !== latest.current) return
      setSearching(false)
      if (r.ok) {
        setResults(r.results)
        setError(null)
        // Enter opens the best match, not "See all results".
        const first = groupResults(r.results)[0]?.[1][0]
        setSelected(first ? `${first.kind}-${first.id}` : "see-all-results")
      } else {
        setError(r.error)
      }
    }, 200)
    return () => window.clearTimeout(t)
  }, [term])

  function changeQuery(value: string) {
    setQ(value)
    if (value.trim().length < 2) {
      latest.current++
      setResults([])
      setSearching(false)
      setError(null)
    }
  }

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) changeQuery("")
  }

  const go = React.useCallback((fn: () => void) => {
    setOpen(false)
    setQ("")
    setResults([])
    fn()
  }, [])

  const needle = term.toLowerCase()
  const navGroups = ALL_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !needle || `${g.label} ${i.title}`.toLowerCase().includes(needle)),
  })).filter((g) => g.items.length)
  const themes = THEMES.filter((t) => !needle || t.label.toLowerCase().includes(needle))
  const groups = groupResults(results)
  const searchable = term.length >= 2

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-9 justify-center px-0 text-muted-foreground sm:w-56 sm:justify-start sm:px-2.5"
      >
        <Search aria-hidden />
        <span className="sr-only sm:not-sr-only">Search…</span>
        <KbdGroup className="ml-auto hidden sm:inline-flex">
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={changeOpen}
        title="Search"
        description="Search the workspace or jump to a page"
      >
        <Command shouldFilter={false} loop value={selected} onValueChange={setSelected}>
          <CommandInput
            value={q}
            onValueChange={changeQuery}
            placeholder="Search projects, tasks, docs, variables… or a page"
          />
          <CommandList className="max-h-[min(70dvh,28rem)]">
            <CommandEmpty>No results.</CommandEmpty>
            {searchable ? (
              <>
                {searching && !groups.length ? (
                  <p
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"
                    role="status"
                  >
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Searching…
                  </p>
                ) : null}
                {error ? (
                  <p className="px-3 py-2 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                {groups.map(([kind, items]) => {
                  const Icon = SEARCH_KIND_ICONS[kind]
                  return (
                    <CommandGroup key={kind} heading={SEARCH_KIND_LABELS[kind]}>
                      {items.map((r) => {
                        const meta = metaLabel(r.kind, r.meta)
                        return (
                          <CommandItem
                            key={`${r.kind}-${r.id}`}
                            value={`${r.kind}-${r.id}`}
                            onSelect={() => go(() => router.push(r.href))}
                            className="items-start"
                          >
                            <Icon className="mt-0.5" />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate">{r.title}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {[r.projectName, meta].filter(Boolean).join(" · ")}
                                {r.excerpt ? (
                                  <>
                                    {r.projectName || meta ? " · " : null}
                                    <Highlighted text={r.excerpt} />
                                  </>
                                ) : null}
                              </span>
                            </span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )
                })}
                <CommandGroup>
                  <CommandItem
                    value="see-all-results"
                    onSelect={() => go(() => router.push(`/search?q=${encodeURIComponent(term)}`))}
                  >
                    <Search />
                    See all results for &ldquo;{term}&rdquo;
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}
            {navGroups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`nav ${group.label} ${item.title}`}
                    onSelect={() => go(() => router.push(item.href))}
                  >
                    <item.icon />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {themes.length ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Theme">
                  {themes.map((t) => (
                    <CommandItem
                      key={t.value}
                      value={`theme ${t.label}`}
                      onSelect={() => go(() => setTheme(t.value))}
                    >
                      <t.icon />
                      {t.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
