import { ExternalLink } from "lucide-react"

import { formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { HandoffView } from "../queries"

/** A handoff snapshot (Spec FR-07 handoff fields). Only filled fields are shown. */
export function HandoffCard({
  handoff,
  timeZone,
  latest = false,
  className,
}: {
  handoff: HandoffView
  timeZone: string
  latest?: boolean
  className?: string
}) {
  const rows = [
    ["Next action", handoff.nextAction],
    ["Completed", handoff.completedSummary],
    ["Current state", handoff.currentState],
    ["Remaining", handoff.remainingWork],
    ["Blockers", handoff.blockers],
    ["Technical notes", handoff.technicalNotes],
  ].filter((r): r is [string, string] => Boolean(r[1]))

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        latest && "bg-muted/30",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{latest ? "Latest handoff" : "Handoff"}</h3>
        <time
          dateTime={handoff.createdAt}
          title={formatDateTime(handoff.createdAt, timeZone) ?? undefined}
          className="text-xs text-muted-foreground"
        >
          {formatRelative(handoff.createdAt)}
        </time>
      </header>
      <dl className="flex flex-col gap-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "text-sm whitespace-pre-wrap",
                label === "Next action" && "font-medium",
                label === "Blockers" && "text-status-blocked",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
        {handoff.relatedLinks.length ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Related links</dt>
            <dd className="flex flex-wrap gap-x-3 gap-y-1">
              {handoff.relatedLinks.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                >
                  {l.label}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  )
}
