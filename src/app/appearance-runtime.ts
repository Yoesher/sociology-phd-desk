import { readStoredAppearance, type AppAppearance } from '../i18n/settings'

export function applyAppearanceSettings(appearance: AppAppearance): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.motion = appearance.motion
  root.dataset.font = appearance.font
  root.dataset.template = appearance.template
  root.dataset.textSize = appearance.textSize
  const reduced = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  root.dataset.motionEnabled = String(appearance.motion !== 'none' && !reduced)
  if (root.dataset.motionEnabled === 'false') {
    try {
      document.getAnimations?.().forEach(animation => animation.cancel())
    } catch {
      // Unsupported animation APIs never prevent preferences or content from applying.
    }
  }
}

export function applyStoredAppearance(): void {
  applyAppearanceSettings(readStoredAppearance())
}
