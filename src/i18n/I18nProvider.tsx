import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { messages, type MessageKey } from './messages'
import { domainLabelKeys } from './domainLabels'
import { readStoredLocale, storeLocale, type AppLocale } from './settings'
import { I18nContext, type I18nContextValue, type MessageParameters } from './context'

function interpolate(template: string, parameters?: MessageParameters) {
  if (!parameters) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(parameters, key) ? String(parameters[key]) : match,
  )
}

function parseDate(value?: string) {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function createValue(locale: AppLocale, setLocale: (locale: AppLocale) => void): I18nContextValue {
  const t = (key: MessageKey, parameters?: MessageParameters) =>
    interpolate(messages[locale][key], parameters)

  return {
    locale,
    setLocale,
    t,
    formatDate: (value, fallback = t('common.notSet')) => {
      const date = parseDate(value)
      if (!value) return fallback
      if (!date) return value
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date)
    },
    formatCompactDate: (value) => {
      const date = parseDate(value)
      if (!value) return '—'
      if (!date) return value
      return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
    },
    formatNumber: (value) => new Intl.NumberFormat(locale).format(value),
    labelEnum: (value) => t(domainLabelKeys[value]),
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(readStoredLocale)

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale)
    storeLocale(nextLocale)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = messages[locale]['app.documentTitle']
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', messages[locale]['app.metaDescription'])
  }, [locale])

  useEffect(() => {
    const clearLocalizedValidity = (event: Event) => {
      const control = event.target
      if (
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
      ) {
        control.setCustomValidity('')
      }
    }
    const localizeInvalidControl = (event: Event) => {
      const control = event.target
      if (
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
      ) {
        control.setCustomValidity(
          control.validity.valueMissing
            ? messages[locale]['validation.required']
            : messages[locale]['validation.invalid'],
        )
      }
    }

    document.addEventListener('invalid', localizeInvalidControl, true)
    document.addEventListener('input', clearLocalizedValidity, true)
    document.addEventListener('change', clearLocalizedValidity, true)
    return () => {
      document.removeEventListener('invalid', localizeInvalidControl, true)
      document.removeEventListener('input', clearLocalizedValidity, true)
      document.removeEventListener('change', clearLocalizedValidity, true)
    }
  }, [locale])

  const value = useMemo(() => createValue(locale, setLocale), [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
