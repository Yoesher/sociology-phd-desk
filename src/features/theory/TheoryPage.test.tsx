import { useState, type ReactNode } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { I18nProvider, useI18n } from '../../i18n'
import { createDemoWorkspace } from '../../models/demo'
import type { TheoryMemoType, WorkspaceData } from '../../models/domain'
import { TheoryPage } from './TheoryPage'

function LocaleControls() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('en')}>Test English</button>
}

function renderTheory(
  initialData = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z')),
  route = '/theory?view=memos',
) {
  let snapshot = initialData

  function Harness({ children }: { children: ReactNode }) {
    const [data, setData] = useState(initialData)
    snapshot = data
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => {
      setData((current) => {
        const next = updater(current)
        snapshot = next
        return next
      })
    }
    const context: WorkspaceContextValue = {
      data,
      loading: false,
      saving: false,
      error: null,
      updateData,
      setActiveProject: vi.fn(),
      replaceWith: vi.fn(),
      mergeWith: vi.fn() as WorkspaceContextValue['mergeWith'],
      resetDemo: vi.fn(),
      refresh: vi.fn(),
      clearError: vi.fn(),
    }
    return <WorkspaceContext.Provider value={context}>{children}</WorkspaceContext.Provider>
  }

  const result = render(
    <I18nProvider>
      <LocaleControls />
      <Harness>
        <MemoryRouter initialEntries={[route]}>
          <TheoryPage />
        </MemoryRouter>
      </Harness>
    </I18nProvider>,
  )
  return { ...result, getSnapshot: () => snapshot }
}

describe('TheoryPage research workflow', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => cleanup())

  it('creates, reads, edits, and deletes a same-project memo without persisting prompts or deleting endpoints', async () => {
    const user = userEvent.setup()
    const initial = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    const theoryProject = initial.projects.find((project) => project.method === 'Theoretical')!
    const relatedQuestion = initial.researchQuestions.find((item) => item.projectId === theoryProject.id)!
    const relatedClaim = initial.claims.find((item) => item.projectId === theoryProject.id)!
    const theoryLiterature = {
      ...initial.literature[0],
      id: 'theory-literature',
      projectId: theoryProject.id,
      title: 'User theory source',
      isDemo: false,
    }
    const otherQuestion = initial.researchQuestions.find((item) => item.projectId !== theoryProject.id)!
    const isolated: WorkspaceData = { ...initial, literature: [...initial.literature, theoryLiterature] }
    const { getSnapshot } = renderTheory(isolated)

    await user.click(screen.getAllByRole('button', { name: '新建理论备忘' })[0])
    const dialog = screen.getByRole('dialog', { name: '新建理论备忘' })
    const projectSelect = within(dialog).getByLabelText(/项目/) as HTMLSelectElement
    await user.selectOptions(projectSelect, theoryProject.id)

    const typeSelect = within(dialog).getByLabelText(/备忘类型/) as HTMLSelectElement
    const rawTypes = within(typeSelect).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)
    expect(rawTypes).toEqual(['concept', 'mechanism', 'dialogue', 'counterargument', 'boundary', 'synthesis'])
    await user.selectOptions(typeSelect, 'dialogue')

    expect(within(dialog).getByText('本文真正推进了哪一步？')).toBeInTheDocument()
    expect(within(dialog).queryByText(otherQuestion.text)).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/标题/), '理论对话草稿')
    const memoContent = within(dialog).getByLabelText(/研究者撰写的正文/) as HTMLTextAreaElement
    expect((within(dialog).getByLabelText(/标题/) as HTMLInputElement).maxLength).toBe(1_000)
    await user.type(memoContent, '  仅保存研究者自己的推理。  ')
    await user.click(within(dialog).getByLabelText(relatedQuestion.text))
    await user.click(within(dialog).getByLabelText(relatedClaim.text))
    await user.click(within(dialog).getByLabelText(theoryLiterature.title))
    await user.click(within(dialog).getByRole('button', { name: '创建备忘' }))

    await waitFor(() => expect(getSnapshot().theoryMemos.find((memo) => memo.title === '理论对话草稿')).toMatchObject({
      projectId: theoryProject.id,
      memoType: 'dialogue',
      content: '  仅保存研究者自己的推理。  ',
      relatedQuestionIds: [relatedQuestion.id],
      relatedClaimIds: [relatedClaim.id],
      relatedLiteratureIds: [theoryLiterature.id],
    }))
    expect(getSnapshot().theoryMemos.find((memo) => memo.title === '理论对话草稿')?.content).not.toContain('本文真正推进')

    await user.click(screen.getByRole('button', { name: '查看备忘“理论对话草稿”' }))
    expect(screen.getByRole('dialog', { name: '理论对话草稿' })).toHaveTextContent('User theory source')
    await user.click(within(screen.getByRole('dialog', { name: '理论对话草稿' })).getByRole('button', { name: '编辑' }))
    const editDialog = screen.getByRole('dialog', { name: '编辑理论备忘' })
    const content = within(editDialog).getByLabelText(/研究者撰写的正文/)
    await user.clear(content)
    await user.type(content, '修订后的研究者推理。')
    await user.click(within(editDialog).getByRole('button', { name: '保存备忘' }))
    await waitFor(() => expect(getSnapshot().theoryMemos.find((memo) => memo.title === '理论对话草稿')?.content).toBe('修订后的研究者推理。'))

    await user.click(screen.getByRole('button', { name: '删除备忘“理论对话草稿”' }))
    const deleteDialog = screen.getByRole('dialog', { name: '删除“理论对话草稿”？' })
    expect(deleteDialog).toHaveTextContent('1 个问题、1 条主张和 1 篇文献关联')
    await user.click(within(deleteDialog).getByRole('button', { name: '删除备忘' }))
    await waitFor(() => expect(getSnapshot().theoryMemos.some((memo) => memo.title === '理论对话草稿')).toBe(false))
    expect(getSnapshot().researchQuestions.some((item) => item.id === relatedQuestion.id)).toBe(true)
    expect(getSnapshot().claims.some((item) => item.id === relatedClaim.id)).toBe(true)
    expect(getSnapshot().literature.some((item) => item.id === theoryLiterature.id)).toBe(true)
  })

  it('supports deep-linked views, an empirical project, filtering, and English chrome without translating content', async () => {
    const user = userEvent.setup()
    const initial = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    const empiricalProject = initial.projects.find((project) => project.method !== 'Theoretical')!
    const empiricalMemo = {
      ...initial.theoryMemos[0],
      id: 'empirical-boundary',
      projectId: empiricalProject.id,
      memoType: 'boundary' as TheoryMemoType,
      title: '研究者的经验项目边界备忘',
      content: '用户内容保持原样',
      relatedQuestionIds: [],
      relatedClaimIds: [],
      relatedLiteratureIds: [],
      isDemo: false,
    }
    renderTheory({ ...initial, theoryMemos: [...initial.theoryMemos, empiricalMemo] }, '/theory?view=counterarguments')

    expect(screen.getByRole('button', { name: '反例与边界', current: 'page' })).toBeInTheDocument()
    expect(screen.getByText(empiricalMemo.title)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '理论总览' }))
    await user.click(screen.getByRole('button', { name: new RegExp(empiricalProject.shortTitle) }))
    await user.click(screen.getByRole('button', { name: '反例与边界' }))
    expect(screen.getByText(empiricalMemo.title)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Test English' }))
    expect(screen.getByRole('heading', { name: 'Theory Research' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Counterarguments & Boundaries', current: 'page' })).toBeInTheDocument()
    expect(screen.getByText(empiricalMemo.title)).toBeInTheDocument()
    expect(screen.getByText('用户内容保持原样')).toBeInTheDocument()
  })

  it('consumes a header create request without reopening it after switching memo views', async () => {
    const user = userEvent.setup()
    renderTheory(undefined, '/theory?view=concepts')

    await user.click(screen.getAllByRole('button', { name: '新建理论备忘' })[0])
    const createDialog = screen.getByRole('dialog', { name: '新建理论备忘' })
    await user.click(within(createDialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '新建理论备忘' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '机制分析' }))
    expect(screen.getByRole('button', { name: '机制分析', current: 'page' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '新建理论备忘' })).not.toBeInTheDocument()
  })
})
