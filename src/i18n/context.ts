import { createContext, useContext } from 'react'
import type { LocalizedDomainValue } from './domainLabels'
import type { MessageKey } from './messages'
import type { AppLocale } from './settings'

export type MessageParameters = Record<string, string | number>

export interface I18nContextValue {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: MessageKey, parameters?: MessageParameters) => string
  formatDate: (value?: string, fallback?: string) => string
  formatCompactDate: (value?: string) => string
  formatNumber: (value: number) => string
  labelEnum: (value: LocalizedDomainValue) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}
