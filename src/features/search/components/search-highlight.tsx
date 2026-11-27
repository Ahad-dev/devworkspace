import {
  Boxes,
  FileText,
  FolderKanban,
  GitBranch,
  KeyRound,
  Layers,
  ListTodo,
  Server,
  SquareTerminal,
  Variable,
  type LucideIcon,
} from "lucide-react"

import { splitHighlights, type SearchKind } from "../utils"

export const SEARCH_KIND_ICONS: Record<SearchKind, LucideIcon> = {
  project: FolderKanban,
  task: ListTodo,
  document: FileText,
  command: SquareTerminal,
  environment: Server,
  variable: Variable,
  service: Boxes,
  account: KeyRound,
  repository: GitBranch,
  technology: Layers,
}

/** An excerpt with its matched words highlighted. Plain text only: React escapes the rest. */
export function Highlighted({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {splitHighlights(text).map((p, i) =>
        p.match ? (
          <mark key={i} className="rounded-sm bg-yellow-500/25 px-0.5 text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  )
}
