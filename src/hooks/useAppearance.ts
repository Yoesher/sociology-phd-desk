import { useContext, useSyncExternalStore } from 'react'
import { AppearanceContext } from '../app/appearance-context'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function readReducedMotion(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.(reducedMotionQuery).matches ?? false)
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const media = typeof window !== 'undefined' ? window.matchMedia?.(reducedMotionQuery) : undefined
  if (!media) return () => {}
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }
  if (typeof media.addListener === 'function') {
    media.addListener(onChange)
    return () => media.removeListener(onChange)
  }
  return () => {}
}

export function useAppearance() {
  return useContext(AppearanceContext)
}

export function useReducedMotionPreference(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, () => false)
}

export function useMotionPreference() {
  const { appearance } = useAppearance()
  const reducedMotion = useReducedMotionPreference()
  const animationsEnabled = appearance.motion !== 'none' && !reducedMotion
  return {
    motion: appearance.motion,
    effectiveMotion: animationsEnabled ? appearance.motion : 'none' as const,
    animationsEnabled,
    reducedMotion,
  }
}
