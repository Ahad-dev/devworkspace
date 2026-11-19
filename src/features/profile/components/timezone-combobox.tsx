"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { listTimezones, utcOffsetLabel } from "@/lib/timezones"
import { cn } from "@/lib/utils"

/** Searchable IANA timezone picker. Submits via a hidden input named `name`. */
export function TimezoneCombobox({
  id,
  name,
  value,
  onChange,
  invalid,
}: {
  id: string
  name: string
  value: string
  onChange: (tz: string) => void
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const zones = React.useMemo(() => listTimezones(), [])

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {value}
              <span className="ml-2 text-muted-foreground">{utcOffsetLabel(value)}</span>
            </span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search timezones…" />
            <CommandList>
              <CommandEmpty>No timezone found.</CommandEmpty>
              <CommandGroup>
                {zones.map((tz) => (
                  <CommandItem
                    key={tz}
                    value={tz}
                    onSelect={() => {
                      onChange(tz)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn(tz === value ? "opacity-100" : "opacity-0")} aria-hidden />
                    <span className="truncate">{tz}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
