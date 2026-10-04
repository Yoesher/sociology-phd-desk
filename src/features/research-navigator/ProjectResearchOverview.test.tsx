import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n'
import { createEmptyWorkspace } from '../../models/empty-workspace'
import type { EntityMetadata, ResearchTask, WorkspaceData } from '../../models/domain'
import { exportWorkspaceJson, validateWorkspace } from '../../utils/workspace-transfer'
import { ProjectResearchOverview } from './ProjectResearchOverview'
import type { RecordKind } from './research-index'

const timestamp = '2026-10-04T00:00:00.000Z'
const meta = (id: string): EntityMetadata => ({ id, createdAt: timestamp, updatedAt: timestamp, isDemo: false })

function fixture(): WorkspaceData {
  const data = createEmptyWorkspace({ id: 'overview-workspace', name: 'SYNTHETIC overview', now: new Date(timestamp) })
  data.projects = [
    { ...meta('project-a'), title: 'SYNTHETIC 项目 A', shortTitle: 'A', topic: 'Question formation', method: 'Mixed Methods', status: 'Design', startDate: '2026-10-01', notes: '' },
    { ...meta('project-b'), title: 'SYNTHETIC Project B', shortTitle: 'B', topic: 'Independent project', method: 'Qualitative', status: 'Data / Fieldwork', startDate: '2026-10-01', notes: '' },
  ]
  data.workspace.activeProjectId = 'project-b'
  const task = (id: string, projectId: string, status: ResearchTask['status'], dueDate: string): ResearchTask => ({
    ...meta(id), projectId, title: id, category: 'Reading', priority: 'Medium', status, dueDate, notes: '',
  })
  data.tasks = [
    task('task-overdue', 'project-a', 'To Do', '2026-10-03'),
    task('task-today', 'project-a', 'In Progress', '2026-10-04'),
    task('task-done', 'project-a', 'Done', '2026-10-02'),
    task('task-deferred', 'project-a', 'Deferred', '2026-10-05'),
    task('task-b', 'project-b', 'To Do', '2026-10-10'),
  ]
  data.researchQuestions = [
    { ...meta('question-linked'), projectId: 'project-a', text: 'Linked question', status: 'active', notes: '' },
    { ...meta('question-draft'), projectId: 'project-a', text: 'Developing question', status: 'draft', notes: '' },
    { ...meta('question-addressed'), projectId: 'project-a', text: 'Addressed question', status: 'addressed', notes: '' },
  ]
  data.claims = [{ ...meta('claim-a'), projectId: 'project-a', text: 'SYNTHETIC claim', status: 'draft', notes: '' }]
  data.claimQuestionLinks = [{ ...meta('link-a'), projectId: 'project-a', claimId: 'claim-a', researchQuestionId: 'question-linked' }]
  data.theoryMemos = [{ ...meta('memo-a'), projectId: 'project-a', memoType: 'concept', title: 'Concept memo', content: 'SYNTHETIC content', relatedQuestionIds: ['question-linked'], relatedClaimIds: ['claim-a'], relatedLiteratureIds: ['literature-a'] }]
  const pdfText = '%PDF-1.4\nSYNTHETIC overview attachment\n%%EOF'
  data.literature = [{ ...meta('literature-a'), projectId: 'project-a', title: 'SYNTHETIC article', authors: ['Synthetic Author'], status: 'To Read', priority: 'Medium', whyRead: '', notes: '', localPdf: { fileName: 'SYNTHETIC.pdf', size: pdfText.length, base64: btoa(pdfText) } }]
  data.fieldSites = [
    { ...meta('site-a1'), projectId: 'project-a', nameOrAlias: 'Site alias one', status: 'Active', notes: '' },
    { ...meta('site-a2'), projectId: 'project-a', nameOrAlias: 'Site alias two', status: 'Planned', notes: '' },
    { ...meta('site-b'), projectId: 'project-b', nameOrAlias: 'Site alias B', status: 'Active', notes: '' },
  ]
  const image = { fileName: 'SYNTHETIC.png', mimeType: 'image/png' as const, size: 68, width: 1, height: 1, base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=' }
  data.fieldMaps = ['map-a1', 'map-a2'].map((id) => ({ ...meta(id), projectId: 'project-a', title: id, image: { ...image }, markers: [{ fieldSiteId: 'site-a1', x: 0.25, y: 0.75 }] }))
  data.interviews = [{ ...meta('interview-a'), projectId: 'project-a', fieldSiteId: 'site-a1', participantAlias: 'SYNTHETIC alias', status: 'Planned', transcriptStatus: 'Not Started', codingStatus: 'Not Started', memoStatus: 'Not Started', notes: '' }]
  data.datasets = [{ ...meta('dataset-a'), projectId: 'project-a', name: 'SYNTHETIC dataset', wave: '2026', source: 'Synthetic', notes: '' }]
  data.analysisRuns = [{ ...meta('analysis-a'), projectId: 'project-a', datasetId: 'dataset-a', date: '2026-10-04', software: 'R', sample: 'Synthetic', model: 'Synthetic model', outcome: '', keyPredictor: '', status: 'Planned', resultSummary: '' }]
  data.evidence = [{ ...meta('evidence-a'), projectId: 'project-a', claim: 'SYNTHETIC free text', evidenceType: 'Other', source: '', locator: '', finding: '', supportLevel: 'Unclear', limitations: '', manuscriptLocation: '' }]
  data.manuscripts = [{ ...meta('manuscript-a'), projectId: 'project-a', title: 'SYNTHETIC manuscript', targetJournal: '', status: 'Drafting', wordCount: 300, nextAction: '' }]
  data.submissions = [{ ...meta('submission-a'), projectId: 'project-a', manuscriptId: 'manuscript-a', journal: 'SYNTHETIC journal', manuscriptVersion: 'draft', status: 'Preparing', editorialStatus: '', notes: '' }]
  data.reviewerComments = [
    { ...meta('review-open'), submissionId: 'submission-a', reviewer: 'SYNTHETIC reviewer', commentId: 'R1', comment: 'Open comment', severity: 'Minor', response: '', revisionAction: '', status: 'Open' },
    { ...meta('review-resolved'), submissionId: 'submission-a', reviewer: 'SYNTHETIC reviewer', commentId: 'R2', comment: 'Resolved comment', severity: 'Minor', response: 'Done', revisionAction: 'Done', status: 'Resolved' },
  ]
  return data
}

function freezeDeep(value: object) {
  for (const nested of Object.values(value)) if (nested !== null && typeof nested === 'object') freezeDeep(nested)
  Object.freeze(value)
}

function LocaleControls() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('en')}>Test English</button>
}

function renderOverview(data: WorkspaceData, projectId = '', onBrowse = vi.fn()) {
  const view = render(<I18nProvider><ProjectResearchOverview data={data} projectId={projectId} onBrowse={onBrowse} /><LocaleControls /></I18nProvider>)
  return { ...view, onBrowse }
}

describe('ProjectResearchOverview', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // Local noon fixes the calendar day in every runner timezone without faking interaction timers.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 4, 12, 0, 0))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('summarizes actual project records and unique marked sites without a completion score', () => {
    const data = fixture()
    expect(validateWorkspace(data).success).toBe(true)
    renderOverview(data)
    const project = within(screen.getByRole('article', { name: 'SYNTHETIC 项目 A' }))
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(project.getByRole('button', { name: '全部任务 4' })).toBeInTheDocument()
    expect(project.getByRole('button', { name: '已完成任务 / 全部任务 1 / 4' })).toBeInTheDocument()
    expect(project.getByRole('button', { name: '逾期任务 1' })).toBeInTheDocument()
    expect(project.getByRole('button', { name: '未来七天到期 1' })).toBeInTheDocument()
    expect(project.getByRole('button', { name: '草稿或活跃问题 2' })).toBeInTheDocument()
    expect(project.getByRole('button', { name: '未关联主张的问题 1' })).toBeInTheDocument()
    expect(project.getByRole('button', { name: '已标注田野点 / 全部田野点 1 / 2' })).toBeInTheDocument()
    expect(project.getByRole('button', { name: '待处理或处理中的审稿意见 1' })).toBeInTheDocument()
    expect(screen.getByText('数量反映工作台中已登记的记录。已完成任务数不代表项目完成度或研究质量。')).toBeInTheDocument()
    expect(project.getByText('尚未登记主张关联的问题可能仍在形成中；这里是整理提示，不评价研究质量。')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('browses every supported count in the selected project while preserving the complete portable snapshot', async () => {
    const user = userEvent.setup()
    const data = fixture()
    const before = exportWorkspaceJson(data)
    freezeDeep(data)
    const { onBrowse } = renderOverview(data, 'project-a')
    expect(screen.queryByRole('article', { name: 'SYNTHETIC Project B' })).not.toBeInTheDocument()
    expect(onBrowse).not.toHaveBeenCalled()
    const controls: Array<[string, RecordKind]> = [
      ['全部任务 4', 'task'], ['已完成任务 / 全部任务 1 / 4', 'task'], ['逾期任务 1', 'task'], ['未来七天到期 1', 'task'],
      ['草稿或活跃问题 2', 'question'], ['未关联主张的问题 1', 'question'], ['分析主张 1', 'claim'], ['理论备忘 1', 'theory'],
      ['文献记录 1', 'literature'], ['田野点 2', 'site'], ['已标注田野点 / 全部田野点 1 / 2', 'map'], ['访谈 1', 'interview'],
      ['数据集 1', 'dataset'], ['分析运行 1', 'analysis'], ['证据记录 1', 'evidence'], ['论文 1', 'manuscript'], ['待处理或处理中的审稿意见 1', 'review'],
    ]
    for (const [name, kind] of controls) {
      await user.click(screen.getByRole('button', { name }))
      expect(onBrowse).toHaveBeenLastCalledWith('project-a', kind)
    }
    expect(onBrowse).toHaveBeenCalledTimes(controls.length)
    expect(exportWorkspaceJson(data)).toBe(before)
    expect(data.workspace.activeProjectId).toBe('project-b')
    expect(data.tasks.find((task) => task.id === 'task-b')).toBeDefined()
    expect(data.literature[0]!.localPdf?.base64).toBe(fixture().literature[0]!.localPdf?.base64)
    expect(data.fieldMaps).toHaveLength(2)
  })

  it('uses native keyboard controls and changes labels without translating researcher content', async () => {
    const user = userEvent.setup()
    const data = fixture()
    const before = structuredClone(data)
    const { onBrowse } = renderOverview(data, 'project-b')
    await user.tab()
    expect(screen.getByRole('button', { name: '全部任务 1' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onBrowse).toHaveBeenCalledWith('project-b', 'task')
    await user.click(screen.getByRole('button', { name: 'Test English' }))
    expect(screen.getByRole('region', { name: 'Project overview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Due in the next seven days 1' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'SYNTHETIC Project B' })).toBeInTheDocument()
    expect(screen.getByText('Each field site is counted once across local maps and sketches. Select the marked-site count to browse local maps. Markers describe positions within images.')).toBeInTheDocument()
    expect(data).toEqual(before)
  })

  it('recomputes when the committed snapshot or selected project changes', () => {
    const data = fixture()
    const onBrowse = vi.fn()
    const { rerender } = renderOverview(data, 'project-a', onBrowse)
    const next = structuredClone(data)
    next.tasks = next.tasks.map((task) => task.id === 'task-overdue' ? { ...task, status: 'Done' } : task)
    rerender(<I18nProvider><ProjectResearchOverview data={next} projectId="project-a" onBrowse={onBrowse} /><LocaleControls /></I18nProvider>)
    expect(screen.getByRole('button', { name: '已完成任务 / 全部任务 2 / 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '逾期任务 0' })).toBeInTheDocument()
    rerender(<I18nProvider><ProjectResearchOverview data={next} projectId="project-b" onBrowse={onBrowse} /><LocaleControls /></I18nProvider>)
    expect(screen.queryByRole('article', { name: 'SYNTHETIC 项目 A' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '全部任务 1' })).toBeInTheDocument()
    expect(data.tasks.find((task) => task.id === 'task-overdue')?.status).toBe('To Do')
    expect(onBrowse).not.toHaveBeenCalled()
  })

  it('explains an empty workspace and a removed project without inventing scores or records', () => {
    const data = createEmptyWorkspace({ now: new Date(timestamp) })
    const { rerender, onBrowse } = renderOverview(data)
    expect(screen.getByText('还没有可汇总的项目。可以前往项目模块创建项目。')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    rerender(<I18nProvider><ProjectResearchOverview data={fixture()} projectId="removed-project" onBrowse={onBrowse} /><LocaleControls /></I18nProvider>)
    expect(screen.getByText('该项目已不存在。请选择其他项目或所有项目。')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(onBrowse).not.toHaveBeenCalled()
  })
})
