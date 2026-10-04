import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n'
import { messages } from '../../i18n/messages'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { ProjectScopeContext } from '../../app/project-scope-context'
import { createDemoWorkspace } from '../../models/demo'
import type { WorkspaceData } from '../../models/domain'
import { ResearchNavigator } from './ResearchNavigator'
import { buildResearchIndex, getRelatedRecords } from './research-index'

function renderNavigator(data: WorkspaceData, projectId = '') {
  const updateData = vi.fn()
  const setActiveProject = vi.fn()
  const enter = vi.fn()
  const context: WorkspaceContextValue = {
    data, loading: false, saving: false, error: null, updateData, setActiveProject,
    replaceWith: vi.fn(), mergeWith: vi.fn(), resetDemo: vi.fn(), refresh: vi.fn(), clearError: vi.fn(),
  }
  const close = vi.fn()
  render(<I18nProvider><WorkspaceContext.Provider value={context}><ProjectScopeContext.Provider value={{ projectId, enter }}><MemoryRouter><ResearchNavigator onClose={close} /></MemoryRouter></ProjectScopeContext.Provider></WorkspaceContext.Provider></I18nProvider>)
  return { updateData, setActiveProject, enter, close }
}

describe('read-only bilingual research navigator', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
  afterEach(cleanup)

  it('searches complete-workspace notes only after explicit cross-project selection and never writes', async () => {
    const data = createDemoWorkspace()
    const a = data.projects[0]!.id
    const b = data.projects[1]!.id
    data.tasks = [
      { ...data.tasks[0]!, id: 'a-task', projectId: a, title: 'DEMO A task', notes: '跨模块 匹配 Active' },
      { ...data.tasks[0]!, id: 'b-task', projectId: b, title: 'DEMO B task', notes: '跨模块 匹配 second project' },
    ]
    const before = structuredClone(data)
    const { updateData, setActiveProject, enter } = renderNavigator(data, a)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox', { name: '检索研究记录' }), '跨模块 匹配')
    expect(screen.getByRole('button', { name: /DEMO A task/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /DEMO B task/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: '检索所有项目' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '记录类型' }), 'task')
    await user.click(screen.getByRole('button', { name: /DEMO B task/ }))
    expect(screen.getByRole('heading', { name: 'DEMO B task' })).toHaveFocus()
    const detail = screen.getByRole('region', { name: '记录详情' })
    expect(detail).toHaveTextContent('跨模块 匹配 second project')
    expect(within(detail).getByRole('link', { name: '前往原模块' })).toHaveAttribute('href', '/today')
    expect(data).toEqual(before)
    expect(updateData).not.toHaveBeenCalled()
    expect(setActiveProject).not.toHaveBeenCalled()
    expect(enter).not.toHaveBeenCalled()
    expect(window.location.hash).not.toContain('跨模块')
    expect(localStorage.getItem('navigator')).toBeNull()
  })

  it('keeps every result reachable with 40-record pages and resets pagination on filtering', async () => {
    const data = createDemoWorkspace()
    data.tasks = Array.from({ length: 43 }, (_, i) => ({ ...data.tasks[0]!, id: `task-${i}`, title: `DEMO pagination ${String(i).padStart(2, '0')}` }))
    renderNavigator(data)
    const user = userEvent.setup()
    await user.selectOptions(screen.getByRole('combobox', { name: '记录类型' }), 'task')
    expect(screen.getByRole('status')).toHaveTextContent('43 条记录 · 第 1 / 2 页')
    expect(document.querySelectorAll('.navigator-results > li')).toHaveLength(40)
    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(document.querySelectorAll('.navigator-results > li')).toHaveLength(3)
    await user.type(screen.getByRole('searchbox', { name: '检索研究记录' }), 'pagination 42')
    expect(screen.getByRole('status')).toHaveTextContent('1 条记录 · 第 1 / 1 页')
    expect(screen.getByRole('button', { name: /DEMO pagination 42/ })).toBeVisible()
    await user.clear(screen.getByRole('searchbox', { name: '检索研究记录' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '记录类型' }), 'project')
    await user.click(screen.getByRole('button', { name: new RegExp(data.projects[0]!.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }))
    const index = buildResearchIndex(data)
    const project = index.find((item) => item.key === `project:${data.projects[0]!.id}`)!
    const relatedCount = getRelatedRecords(data, index, project).length
    expect(relatedCount).toBeGreaterThan(40)
    expect(document.querySelectorAll('.navigator-related > li')).toHaveLength(40)
    await user.click(screen.getByRole('button', { name: '下一页关联' }))
    expect(document.querySelectorAll('.navigator-related > li')).toHaveLength(Math.min(40, relatedCount - 40))
    await user.click(screen.getByRole('button', { name: '返回结果' }))
    expect(screen.getByRole('searchbox', { name: '检索研究记录' })).toHaveFocus()
  })

  it('follows real question/claim IDs without rewriting enum-shaped user prose', async () => {
    const data = createDemoWorkspace()
    data.researchQuestions[0]!.notes = 'Active'
    renderNavigator(data)
    const user = userEvent.setup()
    await user.selectOptions(screen.getByRole('combobox', { name: '记录类型' }), 'question')
    await user.click(screen.getByRole('button', { name: new RegExp(data.researchQuestions[0]!.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }))
    const detail = screen.getByRole('region', { name: '记录详情' })
    expect(within(detail).getByText('Active', { exact: true })).toBeVisible()
    const link = data.claimQuestionLinks.find((item) => item.researchQuestionId === data.researchQuestions[0]!.id)!
    const claim = data.claims.find((item) => item.id === link.claimId)!
    await user.click(within(detail).getByRole('button', { name: `分析主张${claim.text}` }))
    expect(screen.getByRole('heading', { name: claim.text })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: '完成' }))
  })

  it('provides every indexed field in both languages and English filters without research translation', () => {
    const data = createDemoWorkspace()
    for (const record of buildResearchIndex(data)) for (const field of record.fields) {
      const key = `navigator.field.${field.label}` as keyof typeof messages.en
      expect(messages.en[key]).toBeTruthy()
      expect(messages['zh-CN'][key]).toBeTruthy()
    }
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
    renderNavigator(data)
    expect(screen.getByRole('dialog', { name: 'Research navigator' })).toBeVisible()
    expect(screen.getByRole('searchbox', { name: 'Search research records' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Record type' }).querySelectorAll('option')).toHaveLength(18)
    expect(data.projects[0]!.title).toBe(createDemoWorkspace().projects[0]!.title)
  })
})
