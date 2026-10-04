import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useMotionPreference } from '../hooks/useAppearance'

export function PageTransitionBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { effectiveMotion, animationsEnabled } = useMotionPreference()
  const previousPath = useRef(location.pathname)
  const previousLocation = useRef(`${location.pathname}?${location.search}`)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const sameModule = previousPath.current === location.pathname

  useEffect(() => {
    const container = containerRef.current
    const locationValue = `${location.pathname}?${location.search}`
    if (previousLocation.current === locationValue) {
      return
    }
    previousLocation.current = locationValue
    if (!container || !animationsEnabled || typeof container.animate !== 'function') {
      previousPath.current = location.pathname
      return
    }
    const moduleChanged = previousPath.current !== location.pathname
    previousPath.current = location.pathname
    const styles = window.getComputedStyle(container)
    const duration = Number.parseFloat(styles.getPropertyValue(moduleChanged ? '--motion-base' : '--motion-fast')) || (moduleChanged ? 200 : 140)
    const easing = styles.getPropertyValue('--ease-standard').trim() || 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    const frames: Keyframe[] = effectiveMotion === 'fade'
      ? [{ opacity: 0 }, { opacity: 1 }]
      : effectiveMotion === 'slide'
        ? [{ opacity: 0, transform: `translateX(${moduleChanged ? 8 : 4}px)` }, { opacity: 1, transform: 'translateX(0)' }]
        : [{ opacity: 0, transform: `translateY(${moduleChanged ? 6 : 3}px)` }, { opacity: 1, transform: 'translateY(0)' }]
    try {
      container.getAnimations?.().forEach((animation) => animation.cancel())
      animationRef.current = container.animate(frames, { duration, easing })
    } catch {
      // Navigation and existing form state never depend on WAAPI support.
      animationRef.current = null
    }
    return () => {
      animationRef.current?.cancel()
      animationRef.current = null
    }
  }, [location.pathname, location.search, effectiveMotion, animationsEnabled])

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
