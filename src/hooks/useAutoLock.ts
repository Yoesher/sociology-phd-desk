import { useCallback, useEffect, useRef } from 'react'
import type { WorkspaceAutoLock } from '../models/workspace-registry'

const MINUTE_IN_MILLISECONDS = 60_000
const LOCK_RETRY_DELAY_IN_MILLISECONDS = 30_000
const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const

export interface UseAutoLockOptions {
  autoLock: WorkspaceAutoLock
  enabled?: boolean
  onLock: () => void | Promise<void>
  /** Injectable clock for deterministic elapsed-time tests. */
  now?: () => number
}

export interface UseAutoLockResult {
  /** Records trusted in-app activity that is not represented by a DOM event. */
  resetAutoLock: () => void
}

/**
 * Locks from elapsed wall time rather than from timer ticks alone. Browser
 * timers may be throttled in the background, so returning to a visible tab
 * always rechecks the true elapsed duration before rescheduling.
 */
export function useAutoLock({
  autoLock,
  enabled = true,
  onLock,
  now = Date.now,
}: UseAutoLockOptions): UseAutoLockResult {
  const onLockRef = useRef(onLock)
  const resetRef = useRef<() => void>(() => undefined)
  onLockRef.current = onLock

  useEffect(() => {
    resetRef.current = () => undefined
    if (!enabled || autoLock === 'never') return

    const delay = autoLock * MINUTE_IN_MILLISECONDS
    let lastActivityAt = now()
    let lastObservedAt = lastActivityAt
    let timeout: ReturnType<typeof setTimeout> | null = null
    let lockRequested = false
    let disposed = false

    const clearScheduledCheck = () => {
      if (timeout === null) return
      clearTimeout(timeout)
      timeout = null
    }

    const requestLock = () => {
      if (lockRequested) return
      lockRequested = true
      clearScheduledCheck()
      const handleLockFailure = () => {
        if (disposed) return
        lockRequested = false
        const observedAt = now()
        if (observedAt < lastObservedAt) {
          lastActivityAt = observedAt
        }
        lastObservedAt = observedAt
        const remaining = delay - (observedAt - lastActivityAt)
        scheduleCheck(
          remaining > 0
            ? remaining
            : LOCK_RETRY_DELAY_IN_MILLISECONDS,
        )
      }
      try {
        void Promise.resolve(onLockRef.current()).catch(handleLockFailure)
      } catch {
        handleLockFailure()
      }
    }

    const scheduleCheck = (remaining: number) => {
      clearScheduledCheck()
      timeout = setTimeout(checkElapsed, Math.max(0, remaining))
    }

    function checkElapsed() {
      if (lockRequested) return
      const observedAt = now()
      if (observedAt < lastObservedAt) {
        // A wall-clock rollback must not silently extend an unattended session.
        requestLock()
        return
      }
      lastObservedAt = observedAt
      const elapsed = observedAt - lastActivityAt
      if (elapsed >= delay) {
        requestLock()
        return
      }
      scheduleCheck(delay - elapsed)
    }

    const resetActivity = () => {
      lastActivityAt = now()
      lastObservedAt = lastActivityAt
      if (!lockRequested) scheduleCheck(delay)
    }

    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') checkElapsed()
    }

    resetRef.current = resetActivity
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', checkWhenVisible)
    scheduleCheck(delay)

    return () => {
      disposed = true
      resetRef.current = () => undefined
      clearScheduledCheck()
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetActivity)
      })
      document.removeEventListener('visibilitychange', checkWhenVisible)
    }
  }, [autoLock, enabled, now])

  const resetAutoLock = useCallback(() => resetRef.current(), [])
  return { resetAutoLock }
}
