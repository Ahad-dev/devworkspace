"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * An input for secret text: master passwords, recovery keys and vault values (Plan P11.5). It has
 * no `name`, so a form submitted before hydration can't send it anywhere; spell-check (which some
 * browsers send to the cloud), autocomplete and capitalisation are off. Optional show/hide.
 */
export function SecretInput({
  id,
  value,
  onChange,
  reveal = false,
  autoFocus,
  invalid,
  placeholder,
  className,
  describedBy,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  /** Adds a show/hide button. */
  reveal?: boolean
  autoFocus?: boolean
  invalid?: boolean
  placeholder?: string
  className?: string
  describedBy?: string
}) {
  const [shown, setShown] = React.useState(false)
  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        autoFocus={autoFocus}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder={placeholder}
        className="font-mono"
      />
      {reveal ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={shown ? "Hide" : "Show"}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOff /> : <Eye />}
        </Button>
      ) : null}
    </div>
  )
}
