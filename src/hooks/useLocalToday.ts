import { useEffect, useState } from 'react'
import { todayIso } from '../app/format'

/** Refresh the local calendar day without polling or writing workspace data. */
export function useLocalToday(): string {
  const [today, setToday] = useState(todayIso)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined

    const refreshAndSchedule = () => {
      if (timeout !== undefined) clearTimeout(timeout)
      const now = new Date()
      setToday(todayIso(now))
      // Construct the next local midnight, rather than adding a fixed 24 hours:
      // daylight-saving changes can make a calendar day shorter or longer.
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timeout = setTimeout(refreshAndSchedule, Math.max(1, nextMidnight.getTime() - now.getTime()))
    }
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') refreshAndSchedule()
    }

    refreshAndSchedule()
    window.addEventListener('focus', refreshAndSchedule)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (timeout !== undefined) clearTimeout(timeout)
      window.removeEventListener('focus', refreshAndSchedule)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}
