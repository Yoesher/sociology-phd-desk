import { useId } from 'react'
import { Button, Field, Modal } from '../components/ui'
import { useAppearance } from '../hooks/useAppearance'
import { useI18n } from '../i18n'
import type { AppFont, AppMotion, AppTemplate, AppTextSize } from '../i18n/settings'

const templates: AppTemplate[] = ['classic', 'paper', 'slate', 'forest']
const fonts: AppFont[] = ['academic', 'sans', 'serif', 'system']
const textSizes: AppTextSize[] = ['standard', 'large', 'larger']
const motions: AppMotion[] = ['gentle', 'fade', 'slide', 'none']

export function AppearancePanel({ onClose }: { onClose: () => void }) {
  const { appearance, setAppearance, resetAppearance, storageAvailable } = useAppearance()
  const { t } = useI18n()
  const templateHintId = useId()
  const fontHintId = useId()
  const motionHintId = useId()

  return (
    <Modal
      open
      title={t('appearance.title')}
      description={t('appearance.description')}
      onClose={onClose}
      size="lg"
      footer={<>
        <Button variant="ghost" onClick={resetAppearance}>{t('appearance.reset')}</Button>
        <Button variant="primary" onClick={onClose}>{t('appearance.done')}</Button>
      </>}
    >
      <div className="appearance-settings">
        <p className="appearance-settings__local">{t('appearance.local')}</p>
        <div className="appearance-settings__grid">
          <div>
          <Field label={t('appearance.template')}>
            <select aria-describedby={templateHintId} value={appearance.template} onChange={(event) => setAppearance('template', event.target.value as AppTemplate)}>
              {templates.map((value) => <option key={value} value={value}>{t(`appearance.template.${value}`)}</option>)}
            </select>
          </Field>
          <small id={templateHintId} className="appearance-settings__hint">{t(`appearance.template.${appearance.template}.detail`)}</small>
          </div>
          <div>
          <Field label={t('appearance.font')}>
            <select aria-describedby={fontHintId} value={appearance.font} onChange={(event) => setAppearance('font', event.target.value as AppFont)}>
              {fonts.map((value) => <option key={value} value={value}>{t(`appearance.font.${value}`)}</option>)}
            </select>
          </Field>
          <small id={fontHintId} className="appearance-settings__hint">{t('appearance.font.local')}</small>
          </div>
          <Field label={t('appearance.textSize')}>
            <select value={appearance.textSize} onChange={(event) => setAppearance('textSize', event.target.value as AppTextSize)}>
              {textSizes.map((value) => <option key={value} value={value}>{t(`appearance.textSize.${value}`)}</option>)}
            </select>
          </Field>
          <Field label={t('appearance.motion')}>
            <select aria-describedby={motionHintId} value={appearance.motion} onChange={(event) => setAppearance('motion', event.target.value as AppMotion)}>
              {motions.map((value) => <option key={value} value={value}>{t(`appearance.motion.${value}`)}</option>)}
            </select>
          </Field>
        </div>
        <section className="appearance-preview" aria-label={t('appearance.preview')}>
          <div className="appearance-preview__spine" aria-hidden="true"><i /><i /><i /></div>
          <div className="appearance-preview__reading">
            <p className="appearance-preview__eyebrow">{t('appearance.preview.eyebrow')}</p>
            <h3>{t('appearance.preview.title')}</h3>
            <p>{t('appearance.preview.text')}</p>
            <span>{t('appearance.preview.tag')}</span>
          </div>
        </section>
        <p id={motionHintId} className="appearance-settings__hint">{t('appearance.motion.note')}</p>
        <p className={`appearance-settings__status${storageAvailable ? '' : ' appearance-settings__status--warning'}`} role={storageAvailable ? 'status' : 'alert'}>
          {t(storageAvailable ? 'appearance.saved' : 'appearance.unsaved')}
        </p>
      </div>
    </Modal>
  )
}
