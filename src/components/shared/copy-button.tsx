"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Older or insecure contexts: a hidden textarea and the legacy copy command.
  const el = document.createElement("textarea")
  el.value = text
  el.setAttribute("readonly", "")
  el.style.position = "fixed"
  el.style.opacity = "0"
  document.body.appendChild(el)
  el.select()
  const ok = document.execCommand("copy")
  el.remove()
  if (!ok) throw new Error("copy failed")
}

/** Copies text to the clipboard and confirms it (Spec FR-11). Never runs anything. */
export function CopyButton({
  text,
  label = "Copy",
  showLabel = false,
  warning,
  className,
  variant = "ghost",
}: {
  text: string
  label?: string
  showLabel?: boolean
  /** Shown in the confirmation toast, e.g. for a destructive or production command. */
  warning?: string
  className?: string
  variant?: "ghost" | "outline" | "secondary"
}) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  async function copy() {
    try {
      await writeClipboard(text)
      setCopied(true)
      if (warning) toast.warning("Copied", { description: warning })
      else toast.success("Copied to clipboard")
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.")
    }
  }

  const Icon = copied ? Check : Copy
  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? "sm" : "icon-sm"}
      onClick={copy}
      aria-label={showLabel ? undefined : label}
      className={cn("shrink-0", className)}
    >
      <Icon aria-hidden />
      {showLabel ? (copied ? "Copied" : label) : null}
    </Button>
  )
}
