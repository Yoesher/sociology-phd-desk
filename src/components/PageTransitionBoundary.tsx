import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export function PageTransitionBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  const previousLocation = useRef(`${location.pathname}?${location.search}`)
  const containerRef = useRef<HTMLDivElement>(null)
  const sameModule = previousPath.current === location.pathname

  useEffect(() => {
    const container = containerRef.current
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const locationValue = `${location.pathname}?${location.search}`
    if (previousLocation.current === locationValue) {
      return
    }
    previousLocation.current = locationValue
    if (!container || reduced || typeof container.animate !== 'function') {
      previousPath.current = location.pathname
      return
    }
    const moduleChanged = previousPath.current !== location.pathname
    previousPath.current = location.pathname
    const styles = window.getComputedStyle(container)
    const duration = Number.parseFloat(styles.getPropertyValue(moduleChanged ? '--motion-base' : '--motion-fast')) || (moduleChanged ? 200 : 140)
    const easing = styles.getPropertyValue('--ease-standard').trim() || 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    container.getAnimations().forEach((animation) => animation.cancel())
    container.animate(
      [
        { opacity: 0, transform: `translateY(${moduleChanged ? 6 : 3}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration, easing },
    )
  }, [location.pathname, location.search])

  return (
    <div
      ref={containerRef}
      className={`motion-page-boundary${sameModule ? ' motion-page-boundary--view' : ''}`}
      data-motion-scope={sameModule ? 'view' : 'route'}
    >
      {children}
    </div>
  )
}
