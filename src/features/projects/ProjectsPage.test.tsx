import { useState, type ReactNode } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { I18nProvider, useI18n } from '../../i18n'
import { createDemoWorkspace } from '../../models/demo'
import type { ResearchQuestion, WorkspaceData } from '../../models/domain'
import { ProjectsPage } from './ProjectsPage'

function LocaleControls() {
  const { setLocale } = useI18n()
  return (
    <div>
      <button type="button" onClick={() => setLocale('zh-CN')}>测试中文</button>
      <button type="button" onClick={() => setLocale('en')}>Test English</button>
    </div>
  )
}

function renderProjects(initialData = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))) {
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
        <ProjectsPage />
      </Harness>
    </I18nProvider>,
  )

  return { ...result, getSnapshot: () => snapshot }
}

describe('ProjectsPage localization and research graph boundary', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => cleanup())

  it('shows Chinese project labels while saving stable English project enum values', async () => {
    const user = userEvent.setup()
    const { getSnapshot } = renderProjects()

    await user.click(screen.getByRole('button', { name: '新建项目' }))
    const dialog = screen.getByRole('dialog', { name: '创建研究项目' })
    await user.type(within(dialog).getByLabelText(/项目标题/), '县域青年就业研究')
    await user.type(within(dialog).getByLabelText(/研究主题/), '劳动与流动')

    const method = within(dialog).getByLabelText(/研究方法/) as HTMLSelectElement
    const localizedOption = within(dialog).getByRole('option', { name: '混合方法' }) as HTMLOptionElement
    expect(localizedOption.value).toBe('Mixed Methods')
    await user.selectOptions(method, 'Mixed Methods')
    await user.click(within(dialog).getByRole('button', { name: '创建项目' }))

    await waitFor(() => expect(getSnapshot().projects[0]).toMatchObject({
      title: '县域青年就业研究',
      method: 'Mixed Methods',
      status: 'Idea',
    }))
  })

  it('creates and edits a many-to-many claim using stable IDs and blocks linked deletion', async () => {
    const user = userEvent.setup()
    const initial = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    const otherProjectId = 'other-project'
    const secondCurrentQuestion: ResearchQuestion = {
      id: 'second-current-question',
      projectId: initial.projects[0].id,
      text: 'How do institutional differences reshape the same mobility process?',
      status: 'draft',
      notes: '',
      createdAt: initial.exportedAt,
      updatedAt: initial.exportedAt,
      isDemo: false,
    }
    const otherQuestion: ResearchQuestion = {
      id: 'other-question',
      projectId: otherProjectId,
      text: 'A question from another project must not be linkable',
      status: 'active',
      notes: '',
      createdAt: initial.exportedAt,
      updatedAt: initial.exportedAt,
      isDemo: false,
    }
    const isolatedInitial: WorkspaceData = {
      ...initial,
      projects: [
        ...initial.projects,
        { ...initial.projects[0], id: otherProjectId, title: 'Other project', shortTitle: 'Other' },
      ],
      researchQuestions: [...initial.researchQuestions, secondCurrentQuestion, otherQuestion],
    }
    const { getSnapshot } = renderProjects(isolatedInitial)

    await user.click(screen.getByRole('button', { name: /Employment Mobility among Young Adults/ }))
    const projectDialog = screen.getByRole('dialog', { name: 'Employment Mobility among Young Adults [DEMO]' })
    expect(within(projectDialog).getByRole('heading', { name: '研究问题' })).toBeInTheDocument()
    expect(within(projectDialog).getByRole('heading', { name: '分析主张' })).toBeInTheDocument()
    expect(within(projectDialog).getByRole('heading', { name: '研究图谱' })).toBeInTheDocument()
    expect(within(projectDialog).getByText('分析主张是研究过程中形成和修订的分析判断。其状态不代表该主张已经被证实，也不代表统计显著性。')).toBeInTheDocument()

    await user.click(within(projectDialog).getAllByRole('button', { name: /查看问题/ })[0])
    const questionView = screen.getByRole('dialog', { name: '研究问题' })
    expect(questionView).toHaveTextContent(initial.researchQuestions[0].notes)
    await user.click(within(questionView).getByRole('button', { name: '关闭对话框' }))

    await user.click(within(projectDialog).getByRole('button', { name: '添加主张' }))
    const claimDialog = screen.getByRole('dialog', { name: '添加分析主张' })
    const claimText = '县域组织网络可能改变青年获得就业信息的路径'
    await user.type(within(claimDialog).getByLabelText(/分析主张/), `  ${claimText}  `)
    const statusSelect = within(claimDialog).getByLabelText(/状态/) as HTMLSelectElement
    const supersededOption = within(statusSelect).getByRole('option', { name: '已被取代' }) as HTMLOptionElement
    expect(supersededOption.value).toBe('superseded')
    await user.selectOptions(statusSelect, 'superseded')
    expect(within(claimDialog).queryByText(otherQuestion.text)).not.toBeInTheDocument()
    await user.click(within(claimDialog).getByText(initial.researchQuestions[0].text))
    await user.click(within(claimDialog).getByText(secondCurrentQuestion.text))
    await user.click(within(claimDialog).getByRole('button', { name: '创建主张' }))

    await waitFor(() => expect(getSnapshot().claims.some((claim) => claim.text === claimText)).toBe(true))
    const createdClaim = getSnapshot().claims.find((claim) => claim.text === claimText)
    expect(createdClaim).toMatchObject({ status: 'superseded', projectId: initial.projects[0].id })
    const createdLinks = getSnapshot().claimQuestionLinks.filter((link) => link.claimId === createdClaim?.id)
    expect(createdLinks).toHaveLength(2)
    expect(new Set(createdLinks.map((link) => link.researchQuestionId))).toEqual(new Set([
      initial.researchQuestions[0].id,
      secondCurrentQuestion.id,
    ]))
    expect(createdLinks.every((link) => link.projectId === initial.projects[0].id)).toBe(true)
    expect(new Set(createdLinks.map((link) => link.id)).size).toBe(2)
    expect(createdLinks.every((link) => /^claim-question-link_/.test(link.id))).toBe(true)
    const createdLinkIds = createdLinks.map((link) => link.id).sort()

    await user.click(within(projectDialog).getByRole('button', { name: `查看主张：${claimText}` }))
    const claimView = screen.getByRole('dialog', { name: '分析主张' })
    expect(claimView).toHaveTextContent(initial.researchQuestions[0].text)
    await user.click(within(claimView).getByRole('button', { name: '关闭对话框' }))

    await user.click(within(projectDialog).getByRole('button', { name: `编辑主张：${claimText}` }))
    const editDialog = screen.getByRole('dialog', { name: '编辑分析主张' })
    await user.selectOptions(within(editDialog).getByLabelText(/状态/), 'active')
    await user.click(within(editDialog).getByRole('button', { name: '保存主张' }))

    await waitFor(() => expect(getSnapshot().claims.find((claim) => claim.id === createdClaim?.id)?.status).toBe('active'))
    expect(getSnapshot().claimQuestionLinks.filter((link) => link.claimId === createdClaim?.id).map((link) => link.id).sort()).toEqual(createdLinkIds)

    await user.click(within(projectDialog).getByRole('button', { name: `删除主张：${claimText}` }))
    const blockedClaimDialog = screen.getByRole('dialog', { name: '删除前请先移除明确关联' })
    expect(blockedClaimDialog).toHaveTextContent(/仍有 2 个问题关联/)
    expect(blockedClaimDialog).toHaveTextContent('现有研究图谱记录与关系已保留')
    await user.click(within(blockedClaimDialog).getByRole('button', { name: '保留记录' }))

    await user.click(within(projectDialog).getByRole('button', { name: `编辑主张：${claimText}` }))
    const unlinkDialog = screen.getByRole('dialog', { name: '编辑分析主张' })
    await user.click(within(unlinkDialog).getByText(initial.researchQuestions[0].text))
    await user.click(within(unlinkDialog).getByText(secondCurrentQuestion.text))
    await user.click(within(unlinkDialog).getByRole('button', { name: '保存主张' }))
    await waitFor(() => expect(getSnapshot().claimQuestionLinks.some((link) => link.claimId === createdClaim?.id)).toBe(false))

    await user.click(within(projectDialog).getByRole('button', { name: `删除主张：${claimText}` }))
    const claimDeleteDialog = screen.getByRole('dialog', { name: '删除分析主张？' })
    await user.click(within(claimDeleteDialog).getByRole('button', { name: '删除主张' }))
    await waitFor(() => expect(getSnapshot().claims.some((claim) => claim.id === createdClaim?.id)).toBe(false))

    await user.click(within(projectDialog).getAllByRole('button', { name: /删除问题/ })[0])
    const blockedDialog = screen.getByRole('dialog', { name: '删除前请先移除明确关联' })
    expect(blockedDialog).toHaveTextContent(/仍有 2 个主张关联/)
    expect(getSnapshot().researchQuestions.some((question) => question.id === initial.researchQuestions[0].id)).toBe(true)
  }, 15_000)

  it('creates, edits, views, and deletes an unlinked first-class research question', async () => {
    const user = userEvent.setup()
    const initial = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    const graphEmpty: WorkspaceData = {
      ...initial,
      researchQuestions: [],
      claims: [],
      claimQuestionLinks: [],
    }
    const { getSnapshot } = renderProjects(graphEmpty)

    await user.click(screen.getByRole('button', { name: /Employment Mobility among Young Adults/ }))
    const projectDialog = screen.getByRole('dialog', { name: 'Employment Mobility among Young Adults [DEMO]' })
    await user.click(within(projectDialog).getByRole('button', { name: '添加问题' }))
    const createDialog = screen.getByRole('dialog', { name: '添加研究问题' })
    const questionText = '  不同组织位置如何塑造青年就业流动？  '
    await user.type(within(createDialog).getByLabelText(/研究问题/), questionText)
    const questionStatus = within(createDialog).getByLabelText(/状态/) as HTMLSelectElement
    const addressedOption = within(questionStatus).getByRole('option', { name: '已回应' }) as HTMLOptionElement
    expect(addressedOption.value).toBe('addressed')
    await user.selectOptions(questionStatus, 'addressed')
    await user.type(within(createDialog).getByLabelText('备注'), '用于检验问题 CRUD')
    await user.click(within(createDialog).getByRole('button', { name: '创建问题' }))

    const normalizedQuestion = questionText.trim()
    await waitFor(() => expect(getSnapshot().researchQuestions[0]).toMatchObject({
      projectId: initial.projects[0].id,
      text: normalizedQuestion,
      status: 'addressed',
    }))

    await user.click(within(projectDialog).getByRole('button', { name: `编辑问题：${normalizedQuestion}` }))
    const editDialog = screen.getByRole('dialog', { name: '编辑研究问题' })
    const editedText = '不同组织位置如何塑造青年跨地区就业流动？'
    await user.clear(within(editDialog).getByLabelText(/研究问题/))
    await user.type(within(editDialog).getByLabelText(/研究问题/), editedText)
    await user.selectOptions(within(editDialog).getByLabelText(/状态/), 'active')
    await user.click(within(editDialog).getByRole('button', { name: '保存问题' }))
    await waitFor(() => expect(getSnapshot().researchQuestions[0]).toMatchObject({ text: editedText, status: 'active' }))

    await user.click(within(projectDialog).getByRole('button', { name: `查看问题：${editedText}` }))
    const viewDialog = screen.getByRole('dialog', { name: '研究问题' })
    expect(viewDialog).toHaveTextContent('用于检验问题 CRUD')
    await user.click(within(viewDialog).getByRole('button', { name: '关闭对话框' }))

    await user.click(within(projectDialog).getByRole('button', { name: `删除问题：${editedText}` }))
    const deleteDialog = screen.getByRole('dialog', { name: '删除研究问题？' })
    await user.click(within(deleteDialog).getByRole('button', { name: '删除问题' }))
    await waitFor(() => expect(getSnapshot().researchQuestions).toHaveLength(0))
  })

  it('counts first-class graph records when protecting project deletion', async () => {
    const user = userEvent.setup()
    const initial = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    const graphOnly: WorkspaceData = {
      ...initial,
      tasks: [],
      literature: [],
      fieldSites: [],
      interviews: [],
      fieldVisits: [],
      datasets: [],
      analysisRuns: [],
      evidence: [],
      researchLogs: [],
      manuscripts: [],
      submissions: [],
      reviewerComments: [],
      claims: [],
      claimQuestionLinks: [],
    }
    renderProjects(graphOnly)

    const projectRow = screen.getByRole('row', { name: /Employment Mobility among Young Adults/ })
    await user.click(within(projectRow).getByRole('button', { name: '删除' }))
    const blockedDialog = screen.getByRole('dialog', { name: '项目仍有关联研究记录' })
    expect(blockedDialog).toHaveTextContent('必须先移动或删除 1 条关联记录')
  })

  it('switches all graph chrome to English without translating user-authored content', async () => {
    const user = userEvent.setup()
    const initial = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    renderProjects(initial)

    await user.click(screen.getByRole('button', { name: /Employment Mobility among Young Adults/ }))
    const userQuestion = initial.researchQuestions[0].text
    expect(screen.getAllByText(userQuestion, { exact: true }).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Test English' }))
    const projectDialog = screen.getByRole('dialog', { name: 'Employment Mobility among Young Adults [DEMO]' })
    expect(within(projectDialog).getByRole('heading', { name: 'Research Questions' })).toBeInTheDocument()
    expect(within(projectDialog).getByRole('heading', { name: 'Claims' })).toBeInTheDocument()
    expect(within(projectDialog).getByRole('heading', { name: 'Research Graph' })).toBeInTheDocument()
    expect(within(projectDialog).getByText('Analytical claims are interpretive judgments formed and revised during the research process. Their status does not indicate that they have been substantiated, nor does it indicate statistical significance.')).toBeInTheDocument()
    expect(within(projectDialog).getAllByText(userQuestion, { exact: true }).length).toBeGreaterThan(0)
    expect(initial.researchQuestions[0].text).toBe(userQuestion)
  })
})
