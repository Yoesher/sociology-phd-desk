import { useEffect, useState } from 'react'
import { readStoredTheme, storeTheme, type AppTheme } from '../i18n/settings'

export type Theme = AppTheme

const getInitialTheme = (): Theme => {
  const saved = readStoredTheme()
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    storeTheme(theme)
  }, [theme])

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
  }
}
