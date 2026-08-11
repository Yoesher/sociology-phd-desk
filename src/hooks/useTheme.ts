import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const getInitialTheme = (): Theme => {
  const saved = window.localStorage.getItem('phd-desk-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('phd-desk-theme', theme)
  }, [theme])

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
  }
}
