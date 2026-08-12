import { useState, type ReactNode } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QUICK_ADD_EVENT, type QuickAddEventDetail } from '../../app/navigationEvents'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { I18nProvider, useI18n } from '../../i18n'
import { createDemoWorkspace } from '../../models/demo'
import type { Manuscript, Submission, WorkspaceData } from '../../models/domain'
import { PublishingPage } from './PublishingPage'
import {
  MANUSCRIPT_STATUSES_BY_VIEW,
  PUBLISHING_VIEWS,
  SUBMISSION_STATUSES_BY_VIEW,
  countUnresolvedReviewerComments,
  manuscriptMatchesPublishingView,
  normalizePublishingView,
  submissionMatchesPublishingView,
} from './publishingViews'

function LocaleControls() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('en')}>Test English</button>
}

function renderPublishing(initialData: WorkspaceData, route = '/publishing') {
  let snapshot = initialData
  const updateSpy = vi.fn()

  function Harness({ children }: { children: ReactNode }) {
    const [data, setData] = useState(initialData)
    snapshot = data
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => {
      updateSpy()
      setData((current) => {
        const next = updater(current)
        snapshot = next
        return next
      })
    }
    return <WorkspaceContext.Provider value={{
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
    }}>{children}</WorkspaceContext.Provider>
  }

  const result = render(<I18nProvider><LocaleControls /><Harness><MemoryRouter initialEntries={[route]}><PublishingPage /></MemoryRouter></Harness></I18nProvider>)
  return { ...result, getSnapshot: () => snapshot, updateSpy }
}

describe('publishing smart-view mappings', () => {
  const base = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
  const manuscript = base.manuscripts[0]
  const submission = base.submissions[0]

  it('maps every fixed view to exact existing raw statuses without inventing a persisted state', () => {
    expect(PUBLISHING_VIEWS).toEqual(['all', 'draft', 'ready', 'submitted', 'review', 'revision', 'rejected', 'accepted', 'published', 'withdrawn'])
    expect(MANUSCRIPT_STATUSES_BY_VIEW).toEqual({
      draft: ['Idea', 'Outline', 'Drafting', 'Internal Review'],
      ready: ['Ready to Submit'],
      review: ['Under Review'],
      revision: ['Revision'],
      rejected: ['Rejected', 'Reworking'],
      accepted: ['Accepted'],
      published: ['Published'],
    })
    expect(SUBMISSION_STATUSES_BY_VIEW).toEqual({
      ready: ['Preparing'],
      submitted: ['Submitted'],
      review: ['Under Review'],
      revision: ['Revision'],
      rejected: ['Rejected'],
      accepted: ['Accepted'],
      withdrawn: ['Withdrawn'],
    })
    expect(manuscriptMatchesPublishingView({ ...manuscript, status: 'Submitted' }, 'submitted')).toBe(false)
    expect(submissionMatchesPublishingView({ ...submission, status: 'Decision Received' }, 'all')).toBe(true)
    expect(submissionMatchesPublishingView({ ...submission, status: 'Decision Received' }, 'revision')).toBe(false)
    expect(normalizePublishingView('not-a-view')).toBe('all')
  })

  it('counts only Open and Addressing reviewer comments as unresolved', () => {
    const comments = ['Open', 'Addressing', 'Resolved', 'Rejected with Rationale'].map((status, index) => ({
      ...base.reviewerComments[0], id: `comment-${index}`, submissionId: submission.id,
      status: status as WorkspaceData['reviewerComments'][number]['status'],
    }))
    expect(countUnresolvedReviewerComments(submission.id, comments)).toBe(2)
  })
})

describe('PublishingPage integrated workflow', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => cleanup())

  function fixture() {
    const initial = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    const project = initial.projects[0]
    const manuscript: Manuscript = {
      ...initial.manuscripts[0],
      id: 'user-revision-manuscript',
      projectId: project.id,
      title: '研究者原始标题不翻译',
      status: 'Revision',
      isDemo: false,
    }
    const rejected: Submission = {
      ...initial.submissions[0],
      id: 'historic-rejected-submission',
      projectId: project.id,
      manuscriptId: manuscript.id,
      journal: 'Journal A',
      manuscriptVersion: 'v1',
      status: 'Rejected',
      isDemo: false,
    }
    const revision: Submission = {
      ...rejected,
      id: 'revision-submission',
      journal: 'Journal B',
      manuscriptVersion: 'v2',
      status: 'Revision',
    }
    const comment = {
      ...initial.reviewerComments[0],
      id: 'open-revision-comment',
      submissionId: revision.id,
      commentId: 'R2-C1',
      status: 'Open' as const,
      isDemo: false,
    }
    return { ...initial, manuscripts: [manuscript], submissions: [rejected, revision], reviewerComments: [comment] }
  }

  it('keeps a deep-linked revision view across language switching without mutating research data', async () => {
    const user = userEvent.setup()
    const initial = fixture()
    const before = structuredClone(initial)
    const { getSnapshot, updateSpy } = renderPublishing(initial, '/publishing?view=revision')

    expect(screen.getByRole('button', { name: /返修中/, current: 'page' })).toBeInTheDocument()
    expect(screen.getAllByText('研究者原始标题不翻译')).toHaveLength(2)
    expect(screen.getByText('1 条未解决意见')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /已接收/ }))
    await user.click(screen.getByRole('button', { name: /返修中/ }))
    expect(updateSpy).not.toHaveBeenCalled()
    expect(getSnapshot()).toEqual(before)

    await user.click(screen.getByRole('button', { name: 'Test English' }))
    expect(screen.getByRole('heading', { name: 'Manuscripts & Publishing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Revision/, current: 'page' })).toBeInTheDocument()
    expect(screen.getAllByText('研究者原始标题不翻译')).toHaveLength(2)
  })

  it('creates a new submission for a rejected manuscript while preserving the rejected history record', async () => {
    const user = userEvent.setup()
    const initial = fixture()
    const { getSnapshot } = renderPublishing(initial, '/publishing?view=rejected')
    expect(screen.getByText(/期刊: Journal A/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: '创建新投稿' })[0])
    const dialog = screen.getByRole('dialog', { name: '创建新投稿' })
    await user.clear(within(dialog).getByLabelText(/期刊/))
    await user.type(within(dialog).getByLabelText(/期刊/), 'Journal C')
    await user.type(within(dialog).getByLabelText(/手稿版本/), 'v3')
    await user.click(within(dialog).getByRole('button', { name: '创建新投稿' }))

    await waitFor(() => expect(getSnapshot().submissions).toHaveLength(3))
    expect(getSnapshot().submissions.find((item) => item.id === 'historic-rejected-submission')).toMatchObject({ journal: 'Journal A', status: 'Rejected', manuscriptVersion: 'v1' })
    expect(getSnapshot().submissions.find((item) => item.journal === 'Journal C')).toMatchObject({ manuscriptId: 'user-revision-manuscript', status: 'Preparing', manuscriptVersion: 'v3' })
  })

  it('honors publishing quick-add events for both independent record types', async () => {
    const initial = fixture()
    renderPublishing(initial)
    window.dispatchEvent(new CustomEvent<QuickAddEventDetail>(QUICK_ADD_EVENT, { detail: { module: 'publishing', action: 'manuscript' } }))
    expect(await screen.findByRole('dialog', { name: '添加手稿' })).toBeInTheDocument()
    await userEvent.setup().click(within(screen.getByRole('dialog', { name: '添加手稿' })).getByRole('button', { name: '取消' }))
    window.dispatchEvent(new CustomEvent<QuickAddEventDetail>(QUICK_ADD_EVENT, { detail: { module: 'publishing', action: 'submission' } }))
    expect(await screen.findByRole('dialog', { name: '添加投稿' })).toBeInTheDocument()
  })

  it('creates an independent reviewer comment and rejects a duplicate ID for the same submission', async () => {
    const user = userEvent.setup()
    const initial = fixture()
    const { getSnapshot } = renderPublishing(initial, '/publishing?view=revision')
    await user.click(screen.getByRole('button', { name: '添加审稿意见' }))
    let dialog = screen.getByRole('dialog', { name: '添加审稿意见' })
    await user.type(within(dialog).getByLabelText(/审稿人标签/), 'Reviewer 3')
    await user.type(within(dialog).getByLabelText(/意见编号/), 'R3-C1')
    await user.type(within(dialog).getByLabelText(/审稿意见/), 'Clarify the boundary condition.')
    await user.click(within(dialog).getByRole('button', { name: '添加意见' }))
    await waitFor(() => expect(getSnapshot().reviewerComments.some((item) => item.commentId === 'R3-C1')).toBe(true))
    expect(getSnapshot().submissions).toHaveLength(initial.submissions.length)
    expect(getSnapshot().manuscripts).toEqual(initial.manuscripts)

    await user.click(screen.getByRole('button', { name: '添加审稿意见' }))
    dialog = screen.getByRole('dialog', { name: '添加审稿意见' })
    await user.type(within(dialog).getByLabelText(/审稿人标签/), 'Reviewer 3')
    await user.type(within(dialog).getByLabelText(/意见编号/), 'R3-C1')
    await user.type(within(dialog).getByLabelText(/审稿意见/), 'Duplicate attempt')
    await user.click(within(dialog).getByRole('button', { name: '添加意见' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('已存在这个意见编号')
    expect(getSnapshot().reviewerComments.filter((item) => item.commentId === 'R3-C1')).toHaveLength(1)
  })
})
