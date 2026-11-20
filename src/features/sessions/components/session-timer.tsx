"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { elapsedSeconds, formatClock } from "../utils"

/*
 * One shared one-second clock for every timer on the page. The server renders with its own
 * timestamp (`renderedAt`), hydration uses that same value, then the live clock takes over:
 * no hydration mismatch, and the time always comes from persisted segment starts.
 */
let now = 0
const listeners = new Set<() => void>()
let interval: ReturnType<typeof setInterval> | null = null

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!interval) {
    now = Date.now()
    interval = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && interval) {
      clearInterval(interval)
      interval = null
    }
  }
}

const getSnapshot = () => (now === 0 ? (now = Date.now()) : now)
const getServerSnapshot = () => null

export function useNow(renderedAt: number) {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) ?? renderedAt
}

export function SessionTimer({
  closedSeconds,
  openSegmentStartedAt,
  renderedAt,
  className,
}: {
  closedSeconds: number
  openSegmentStartedAt: string | null
  renderedAt: number
  className?: string
}) {
  const current = useNow(renderedAt)
  const seconds = elapsedSeconds(closedSeconds, openSegmentStartedAt, current)
  return (
    <span role="timer" className={cn("font-mono tabular-nums", className)}>
      {formatClock(seconds)}
    </span>
  )
}
