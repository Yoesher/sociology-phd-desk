import { useMemo } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { navigationItems } from '../app/navigation'
import { LanguageControl } from '../components/LanguageControl'
import {
  ANALYSIS_RUN_STATUSES,
  ANALYSIS_SOFTWARE,
  CLAIM_STATUSES,
  EVIDENCE_TYPES,
  FIELD_SITE_STATUSES,
  INTERVIEW_STATUSES,
  LITERATURE_STATUSES,
  MANUSCRIPT_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  RESEARCH_METHODS,
  RESEARCH_QUESTION_STATUSES,
  REVIEW_COMMENT_SEVERITIES,
  REVIEW_COMMENT_STATUSES,
  SUBMISSION_STATUSES,
  SUPPORT_LEVELS,
  TASK_CATEGORIES,
  TASK_STATUSES,
  WORK_PRODUCT_STATUSES,
} from '../models/domain'
import { createDemoWorkspace } from '../models/demo'
import { exportWorkspaceJson } from '../utils/workspace-transfer'
import { domainLabelKeys } from './domainLabels'
import { I18nProvider, useI18n } from './index'
import { messages } from './messages'
import { APP_SETTINGS_STORAGE_KEY } from './settings'

const allDomainValues = [
  ...RESEARCH_METHODS,
  ...RESEARCH_QUESTION_STATUSES,
  ...CLAIM_STATUSES,
  ...PROJECT_STATUSES,
  ...TASK_CATEGORIES,
  ...TASK_STATUSES,
  ...PRIORITIES,
  ...LITERATURE_STATUSES,
  ...FIELD_SITE_STATUSES,
  ...INTERVIEW_STATUSES,
  ...WORK_PRODUCT_STATUSES,
  ...ANALYSIS_SOFTWARE,
  ...ANALYSIS_RUN_STATUSES,
  ...EVIDENCE_TYPES,
  ...SUPPORT_LEVELS,
  ...MANUSCRIPT_STATUSES,
  ...SUBMISSION_STATUSES,
  ...REVIEW_COMMENT_SEVERITIES,
  ...REVIEW_COMMENT_STATUSES,
] as const

function placeholderNames(message: string) {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

function localeIndependentExport(workspace: ReturnType<typeof createDemoWorkspace>) {
  const parsed = JSON.parse(exportWorkspaceJson(workspace, false)) as Record<string, unknown>
  delete parsed.exportedAt
  return JSON.stringify(parsed)
}

function LocaleProbe() {
  const { locale, t, formatDate, formatNumber, labelEnum } = useI18n()
  const demo = useMemo(() => createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z')), [])

  return (
    <>
      <LanguageControl />
      <output data-testid="locale">{locale}</output>
      <output data-testid="today">{t('nav.today')}</output>
      <output data-testid="date">{formatDate('2026-08-11')}</output>
      <output data-testid="number">{formatNumber(1234567)}</output>
      <output data-testid="enum">{labelEnum('Active')}</output>
      <input data-testid="required-field" required />
      <output data-testid="research-content">{demo.researchQuestions[0]?.text}</output>
      <output data-testid="export">{localeIndependentExport(demo)}</output>
    </>
  )
}

describe('Chinese-first i18n', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = 'en'
    document.title = ''
    document.head.innerHTML = '<meta name="description" content="">'
  })

  it('switches immediately, updates document metadata, and persists across remounts', async () => {
    const user = userEvent.setup()
    const first = render(<I18nProvider><LocaleProbe /></I18nProvider>)

    expect(screen.getByTestId('locale')).toHaveTextContent('zh-CN')
    expect(screen.getByTestId('today')).toHaveTextContent('今日')
    expect(screen.getByTestId('date')).toHaveTextContent('2026年8月11日')
    expect(screen.getByTestId('number')).toHaveTextContent('1,234,567')
    expect(screen.getByTestId('enum')).toHaveTextContent('进行中')
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
    expect(document.title).toContain('社会学博士研究工作站')

    const requiredField = screen.getByTestId('required-field') as HTMLInputElement
    requiredField.dispatchEvent(new Event('invalid'))
    expect(requiredField.validationMessage).toBe('请填写此必填字段。')

    const researchContent = screen.getByTestId('research-content').textContent
    const exported = screen.getByTestId('export').textContent
    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByTestId('locale')).toHaveTextContent('en')
    expect(screen.getByTestId('today')).toHaveTextContent('Today')
    expect(screen.getByTestId('date')).toHaveTextContent('August 11, 2026')
    expect(screen.getByTestId('enum')).toHaveTextContent('Active')
    expect(screen.getByTestId('research-content')).toHaveTextContent(researchContent ?? '')
    expect(screen.getByTestId('export')).toHaveTextContent(exported ?? '')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(document.title).toBe('Sociology PhD Desk')
    requiredField.dispatchEvent(new Event('invalid'))
    expect(requiredField.validationMessage).toBe('Complete this required field.')

    expect(JSON.parse(window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      language: 'en',
    })

    first.unmount()
    render(<I18nProvider><LocaleProbe /></I18nProvider>)
    expect(screen.getByTestId('locale')).toHaveTextContent('en')
  })

  it('keeps every resource key and interpolation placeholder aligned', () => {
    const englishKeys = Object.keys(messages.en).sort()
    const chineseKeys = Object.keys(messages['zh-CN']).sort()

    expect(chineseKeys).toEqual(englishKeys)
    for (const key of englishKeys) {
      expect(placeholderNames(messages['zh-CN'][key as keyof typeof messages.en])).toEqual(
        placeholderNames(messages.en[key as keyof typeof messages.en]),
      )
    }
  })

  it('localizes all nine navigation items in both languages', () => {
    expect(navigationItems).toHaveLength(9)
    for (const item of navigationItems) {
      expect(messages.en[item.labelKey]).toBeTruthy()
      expect(messages['zh-CN'][item.labelKey]).toBeTruthy()
      expect(messages.en[item.shortLabelKey]).toBeTruthy()
      expect(messages['zh-CN'][item.shortLabelKey]).toBeTruthy()
    }
    expect(navigationItems.map((item) => messages['zh-CN'][item.labelKey])).toEqual([
      '今日',
      '研究项目',
      '文献',
      '田野与访谈',
      '定量分析',
      '证据',
      '研究日志',
      '论文',
      '投稿与修订',
    ])
  })

  it('maps every persisted domain enum to a label without changing its raw value', () => {
    const uniqueValues = [...new Set(allDomainValues)]
    for (const rawValue of uniqueValues) {
      const key = domainLabelKeys[rawValue]
      expect(key).toBeTruthy()
      expect(messages.en[key]).toBeTruthy()
      expect(messages['zh-CN'][key]).toBeTruthy()
    }
    expect(domainLabelKeys.R).toBe('enum.r')
    expect(uniqueValues).toContain('R')
  })
})
