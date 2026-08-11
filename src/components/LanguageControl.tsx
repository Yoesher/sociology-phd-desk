import { useI18n } from '../i18n'

export function LanguageControl({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      className={`language-control ${compact ? 'language-control--compact' : ''}`}
      role="group"
      aria-label={t('language.controlLabel')}
    >
      <button
        type="button"
        aria-pressed={locale === 'zh-CN'}
        onClick={() => setLocale('zh-CN')}
      >
        {t('language.simplifiedChinese')}
      </button>
      <button
        type="button"
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        {t('language.english')}
      </button>
    </div>
  )
}
