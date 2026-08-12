import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FilePenLine, History, MessageSquareText, Send } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { entityMeta, truncate } from '../../app/format'
import { QUICK_ADD_EVENT, type QuickAddEventDetail } from '../../app/navigationEvents'
import { ProjectSelect } from '../../components/ProjectSelect'
import {
  AddButton,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SearchField,
  SectionHeader,
  StatCard,
  type Tone,
} from '../../components/ui'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useI18n, type MessageKey } from '../../i18n'
import {
  MANUSCRIPT_STATUSES,
  REVIEW_COMMENT_SEVERITIES,
  REVIEW_COMMENT_STATUSES,
  SUBMISSION_STATUSES,
  type Manuscript,
  type ReviewerComment,
  type Submission,
} from '../../models/domain'
import {
  PUBLISHING_VIEWS,
  countPublishingView,
  countUnresolvedReviewerComments,
  isReviewerCommentUnresolved,
  manuscriptMatchesPublishingView,
  normalizePublishingView,
  submissionMatchesPublishingView,
  type PublishingView,
} from './publishingViews'
import './publishing.css'

interface ManuscriptDraft {
  title: string
  projectId: string
  targetJournal: string
  status: Manuscript['status']
  wordCount: string
  nextAction: string
  deadline: string
}

interface SubmissionDraft {
  manuscriptId: string
  journal: string
  manuscriptVersion: string
  submissionDate: string
  status: Submission['status']
  editorialStatus: string
  decisionDate: string
  decision: string
  notes: string
}

interface ReviewerDraft {
  submissionId: string
  reviewer: string
  commentId: string
  comment: string
  severity: ReviewerComment['severity']
  response: string
  revisionAction: string
  status: ReviewerComment['status']
}

const emptyManuscriptDraft = (projectId = ''): ManuscriptDraft => ({
  title: '', projectId, targetJournal: '', status: 'Idea', wordCount: '0', nextAction: '', deadline: '',
})

const emptySubmissionDraft = (manuscript?: Manuscript): SubmissionDraft => ({
  manuscriptId: manuscript?.id ?? '',
  journal: manuscript?.targetJournal ?? '',
  manuscriptVersion: '',
  submissionDate: '',
  status: 'Preparing',
  editorialStatus: '',
  decisionDate: '',
  decision: '',
  notes: '',
})

const emptyReviewerDraft = (submissionId = ''): ReviewerDraft => ({
  submissionId, reviewer: '', commentId: '', comment: '', severity: 'Major',
  response: '', revisionAction: '', status: 'Open',
})

const viewLabelKey = (view: PublishingView): MessageKey => `publishing.view.${view}` as MessageKey

const manuscriptTone = (status: Manuscript['status']): Tone => {
  if (status === 'Accepted' || status === 'Published') return 'success'
  if (status === 'Rejected') return 'danger'
  if (status === 'Revision' || status === 'Reworking') return 'warning'
  if (status === 'Submitted' || status === 'Under Review') return 'violet'
  if (status === 'Ready to Submit') return 'blue'
  return status === 'Drafting' || status === 'Internal Review' ? 'accent' : 'neutral'
}

const submissionTone = (status: Submission['status']): Tone => {
  if (status === 'Accepted') return 'success'
  if (status === 'Rejected' || status === 'Withdrawn') return 'danger'
  if (status === 'Revision' || status === 'Decision Received') return 'warning'
  if (status === 'Submitted' || status === 'Under Review') return 'violet'
  return 'neutral'
}

const reviewTone = (status: ReviewerComment['status']): Tone => {
  if (status === 'Resolved') return 'success'
  if (status === 'Rejected with Rationale') return 'violet'
  if (status === 'Addressing') return 'accent'
  return 'warning'
}

export function PublishingPage() {
  const { data, updateData } = useWorkspace()
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [manuscriptOpen, setManuscriptOpen] = useState(false)
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [reviewerOpen, setReviewerOpen] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)
  const [manuscriptDraft, setManuscriptDraft] = useState<ManuscriptDraft>(emptyManuscriptDraft)
  const [submissionDraft, setSubmissionDraft] = useState<SubmissionDraft>(emptySubmissionDraft)
  const [reviewerDraft, setReviewerDraft] = useState<ReviewerDraft>(emptyReviewerDraft)
  const [reviewerError, setReviewerError] = useState(false)
  const view = normalizePublishingView(searchParams.get('view'))

  const openManuscript = () => {
    if (!data?.projects.length) return
    const projectId = data.projects.some((item) => item.id === data.workspace.activeProjectId)
      ? data.workspace.activeProjectId
      : data.projects[0].id
    setManuscriptDraft(emptyManuscriptDraft(projectId))
    setManuscriptOpen(true)
  }

  const openSubmission = (preferred?: Manuscript, isResubmission = false) => {
    if (!data?.manuscripts.length) return
    const manuscript = preferred ?? data.manuscripts.find(
      (item) => item.projectId === (projectFilter || data.workspace.activeProjectId),
    ) ?? data.manuscripts[0]
    setSubmissionDraft(emptySubmissionDraft(manuscript))
    setResubmitting(isResubmission)
    setSubmissionOpen(true)
  }

  const openReviewer = () => {
    if (!data?.submissions.length) return
    const preferred = data.submissions.find((item) => item.projectId === (projectFilter || data.workspace.activeProjectId)) ?? data.submissions[0]
    setReviewerDraft(emptyReviewerDraft(preferred.id))
    setReviewerError(false)
    setReviewerOpen(true)
  }

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as CustomEvent<QuickAddEventDetail>).detail
      if (detail?.module !== 'publishing') return
      if (detail.action === 'manuscript') openManuscript()
      if (detail.action === 'submission') openSubmission()
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  })

  const visibleManuscripts = useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()
    return data.manuscripts.filter((manuscript) => {
      const project = data.projects.find((item) => item.id === manuscript.projectId)
      const corpus = [manuscript.title, manuscript.targetJournal, manuscript.nextAction, project?.title, project?.shortTitle]
        .join(' ').toLowerCase()
      return manuscriptMatchesPublishingView(manuscript, view) &&
        (!projectFilter || manuscript.projectId === projectFilter) &&
        (!query || corpus.includes(query))
    }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }, [data, projectFilter, search, view])

  const visibleSubmissions = useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()
    return data.submissions.filter((submission) => {
      const manuscript = data.manuscripts.find((item) => item.id === submission.manuscriptId)
      const project = data.projects.find((item) => item.id === submission.projectId)
      const corpus = [submission.journal, submission.manuscriptVersion, submission.editorialStatus,
        submission.decision, submission.notes, manuscript?.title, project?.title, project?.shortTitle]
        .join(' ').toLowerCase()
      return submissionMatchesPublishingView(submission, view) &&
        (!projectFilter || submission.projectId === projectFilter) &&
        (!query || corpus.includes(query))
    }).sort((left, right) => (right.submissionDate || right.updatedAt).localeCompare(left.submissionDate || left.updatedAt))
  }, [data, projectFilter, search, view])

  if (!data) return null

  const setView = (nextView: PublishingView) => {
    const next = new URLSearchParams(searchParams)
    if (nextView === 'all') next.delete('view')
    else next.set('view', nextView)
    setSearchParams(next)
  }

  const projectName = (projectId: string) => {
    const project = data.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }

  const manuscriptName = (manuscriptId: string) =>
    data.manuscripts.find((item) => item.id === manuscriptId)?.title || t('submissions.fallback.missingManuscript')

  const saveManuscript = async (event: FormEvent) => {
    event.preventDefault()
    const wordCount = Number(manuscriptDraft.wordCount)
    if (!data.projects.some((item) => item.id === manuscriptDraft.projectId) ||
      !Number.isFinite(wordCount) || wordCount < 0) return
    const record: Manuscript = {
      ...entityMeta('manuscript'),
      title: manuscriptDraft.title.trim(),
      projectId: manuscriptDraft.projectId,
      targetJournal: manuscriptDraft.targetJournal.trim(),
      status: manuscriptDraft.status,
      wordCount: Math.round(wordCount),
      nextAction: manuscriptDraft.nextAction.trim(),
      deadline: manuscriptDraft.deadline || undefined,
    }
    await updateData((current) => ({ ...current, manuscripts: [record, ...current.manuscripts] }))
    setManuscriptOpen(false)
  }

  const saveSubmission = async (event: FormEvent) => {
    event.preventDefault()
    const manuscript = data.manuscripts.find((item) => item.id === submissionDraft.manuscriptId)
    if (!manuscript || !data.projects.some((item) => item.id === manuscript.projectId)) return
    const record: Submission = {
      ...entityMeta('submission'),
      projectId: manuscript.projectId,
      manuscriptId: manuscript.id,
      journal: submissionDraft.journal.trim(),
      submissionDate: submissionDraft.submissionDate || undefined,
      manuscriptVersion: submissionDraft.manuscriptVersion.trim(),
      status: submissionDraft.status,
      editorialStatus: submissionDraft.editorialStatus.trim(),
      decisionDate: submissionDraft.decisionDate || undefined,
      decision: submissionDraft.decision.trim() || undefined,
      notes: submissionDraft.notes.trim(),
    }
    await updateData((current) => ({ ...current, submissions: [record, ...current.submissions] }))
    setSubmissionOpen(false)
  }

  const saveReviewer = async (event: FormEvent) => {
    event.preventDefault()
    const submission = data.submissions.find((item) => item.id === reviewerDraft.submissionId)
    const duplicate = data.reviewerComments.some((item) => item.submissionId === reviewerDraft.submissionId && item.commentId.trim().toLowerCase() === reviewerDraft.commentId.trim().toLowerCase())
    if (!submission || duplicate) { setReviewerError(duplicate); return }
    const record: ReviewerComment = {
      ...entityMeta('review-comment'), submissionId: submission.id,
      reviewer: reviewerDraft.reviewer.trim(), commentId: reviewerDraft.commentId.trim(),
      comment: reviewerDraft.comment.trim(), severity: reviewerDraft.severity,
      response: reviewerDraft.response.trim(), revisionAction: reviewerDraft.revisionAction.trim(),
      status: reviewerDraft.status,
    }
    await updateData((current) => ({ ...current, reviewerComments: [record, ...current.reviewerComments] }))
    setReviewerOpen(false)
  }

  const updateManuscriptStatus = async (id: string, status: Manuscript['status']) => {
    await updateData((current) => ({
      ...current,
      manuscripts: current.manuscripts.map((item) => item.id === id
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item),
    }))
  }

  const updateSubmissionStatus = async (id: string, status: Submission['status']) => {
    await updateData((current) => ({
      ...current,
      submissions: current.submissions.map((item) => item.id === id
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item),
    }))
  }

  const updateReviewerStatus = async (id: string, status: ReviewerComment['status']) => {
    await updateData((current) => ({
      ...current,
      reviewerComments: current.reviewerComments.map((item) => item.id === id
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item),
    }))
  }

  const visibleSubmissionIds = new Set(visibleSubmissions.map((item) => item.id))
  const visibleManuscriptIds = new Set(visibleManuscripts.map((item) => item.id))
  const visibleComments = data.reviewerComments.filter((comment) => {
    const submission = data.submissions.find((item) => item.id === comment.submissionId)
    const includedByParent = Boolean(submission && (
      visibleSubmissionIds.has(submission.id) || visibleManuscriptIds.has(submission.manuscriptId)
    ))
    if (view === 'revision') return includedByParent && isReviewerCommentUnresolved(comment)
    return view === 'all' && includedByParent
  })
  const unresolvedCount = data.reviewerComments.filter(isReviewerCommentUnresolved).length
  const recordCount = visibleManuscripts.length + visibleSubmissions.length

  return (
    <div className="page">
      <PageHeader
        index="09"
        eyebrow={t('publishing.header.eyebrow')}
        title={t('publishing.header.title')}
        description={t('publishing.header.description')}
        actions={<>
          <AddButton onClick={openManuscript} disabled={!data.projects.length} title={!data.projects.length ? t('publishing.disabled.noProject') : undefined}>{t('publishing.action.addManuscript')}</AddButton>
          <AddButton onClick={() => openSubmission()} disabled={!data.manuscripts.length} title={!data.manuscripts.length ? t('publishing.disabled.noManuscript') : undefined}>{t('publishing.action.addSubmission')}</AddButton>
          <AddButton onClick={openReviewer} disabled={!data.submissions.length} title={!data.submissions.length ? t('submissions.disabled.noSubmission') : undefined}>{t('submissions.action.addReviewerComment')}</AddButton>
        </>}
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('publishing.stats.manuscripts')} value={formatNumber(data.manuscripts.length)} tone="accent" />
        <StatCard label={t('publishing.stats.submissions')} value={formatNumber(data.submissions.length)} tone="violet" />
        <StatCard label={t('publishing.stats.openComments')} value={formatNumber(unresolvedCount)} tone={unresolvedCount ? 'warning' : 'neutral'} />
        <StatCard label={t('publishing.stats.published')} value={formatNumber(data.manuscripts.filter((item) => item.status === 'Published').length)} tone="success" />
      </div>

      <section className="panel">
        <nav className="publishing-view-nav" aria-label={t('publishing.view.aria')}>
          {PUBLISHING_VIEWS.map((item) => {
            const count = countPublishingView(item, data.manuscripts, data.submissions)
            return <button key={item} type="button" aria-current={view === item ? 'page' : undefined} onClick={() => setView(item)}>
              {t(viewLabelKey(item))}<span className="publishing-view-nav__count">{formatNumber(count)}</span>
            </button>
          })}
        </nav>

        <div className="toolbar toolbar--wrap">
          <SearchField value={search} onChange={setSearch} placeholder={t('publishing.filter.search')} />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={setProjectFilter} includeAll ariaLabel={t('publishing.filter.project')} />
          <span className="toolbar__count">{t(recordCount === 1 ? 'publishing.count.recordsOne' : 'publishing.count.recordsOther', { count: formatNumber(recordCount) })}</span>
        </div>

        {view === 'rejected' && <aside className="publishing-history-note"><History size={18} /><div><strong>{t('publishing.history.title')}</strong><p>{t('publishing.history.body')}</p></div></aside>}

        {recordCount ? <>
          {visibleManuscripts.length > 0 && <section className="publishing-section">
            <SectionHeader title={t('publishing.section.manuscripts')} description={t('publishing.section.manuscriptsDescription')} />
            <div className="publishing-grid">
              {visibleManuscripts.map((manuscript) => <article className="publishing-card" key={manuscript.id}>
                <header><FilePenLine size={17} /><Badge tone={manuscriptTone(manuscript.status)}>{labelEnum(manuscript.status)}</Badge></header>
                <h3>{manuscript.title}</h3>
                <div className="publishing-card__meta"><span>{t('publishing.card.project')}: {projectName(manuscript.projectId)}</span><span>{t('publishing.card.targetJournal')}: {manuscript.targetJournal}</span><span>{t('publishing.card.wordCount', { count: formatNumber(manuscript.wordCount) })}</span></div>
                <p><strong>{t('publishing.card.nextAction')}:</strong> {truncate(manuscript.nextAction || t('publishing.card.noNextAction'), 180)}</p>
                {manuscript.deadline && <p>{t('publishing.card.deadline', { date: formatDate(manuscript.deadline) })}</p>}
                <div className="publishing-card__actions">
                  <select value={manuscript.status} aria-label={t('publishing.card.updateManuscriptStatus', { title: manuscript.title })} onChange={(event) => void updateManuscriptStatus(manuscript.id, event.target.value as Manuscript['status'])}>
                    {MANUSCRIPT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
                  </select>
                  {view === 'rejected' && <Button size="sm" onClick={() => openSubmission(manuscript, true)}>{t('publishing.action.resubmit')}</Button>}
                </div>
              </article>)}
            </div>
          </section>}

          {visibleSubmissions.length > 0 && <section className="publishing-section">
            <SectionHeader title={t('publishing.section.submissions')} description={t('publishing.section.submissionsDescription')} />
            <div className="publishing-grid">
              {visibleSubmissions.map((submission) => {
                const unresolved = countUnresolvedReviewerComments(submission.id, data.reviewerComments)
                const manuscript = data.manuscripts.find((item) => item.id === submission.manuscriptId)
                return <article className="publishing-card" key={submission.id}>
                  <header><Send size={17} /><Badge tone={submissionTone(submission.status)}>{labelEnum(submission.status)}</Badge></header>
                  <h3>{manuscriptName(submission.manuscriptId)}</h3>
                  <div className="publishing-card__meta"><span>{t('publishing.card.project')}: {projectName(submission.projectId)}</span><span>{t('publishing.card.journal')}: {submission.journal}</span><span>{t('publishing.card.version')}: {submission.manuscriptVersion}</span></div>
                  <p>{truncate(submission.decision || submission.editorialStatus || submission.notes || t('publishing.card.noEditorialRecord'), 180)}</p>
                  <div className="publishing-card__meta"><span>{t('publishing.card.submitted', { date: formatDate(submission.submissionDate, t('publishing.card.noDate')) })}</span><span>{t('publishing.card.decision', { date: formatDate(submission.decisionDate, t('publishing.card.noDate')) })}</span>{view === 'revision' && <Badge tone={unresolved ? 'warning' : 'success'}>{t('publishing.card.unresolvedComments', { count: formatNumber(unresolved) })}</Badge>}</div>
                  <div className="publishing-card__actions">
                    <select value={submission.status} aria-label={t('publishing.card.updateSubmissionStatus', { title: manuscript?.title || submission.journal })} onChange={(event) => void updateSubmissionStatus(submission.id, event.target.value as Submission['status'])}>
                      {SUBMISSION_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
                    </select>
                    {view === 'rejected' && manuscript && <Button size="sm" onClick={() => openSubmission(manuscript, true)}>{t('publishing.action.resubmit')}</Button>}
                  </div>
                </article>
              })}
            </div>
          </section>}
        </> : <EmptyState title={t('publishing.empty.title')} description={t(data.manuscripts.length || data.submissions.length ? 'publishing.empty.filtered' : 'publishing.empty.initial')} action={(search || projectFilter || view !== 'all') ? <Button onClick={() => { setSearch(''); setProjectFilter(''); setView('all') }}>{t('publishing.action.clearFilters')}</Button> : <AddButton onClick={openManuscript} disabled={!data.projects.length}>{t('publishing.action.addManuscript')}</AddButton>} />}

        {visibleComments.length > 0 && <section className="publishing-section">
          <SectionHeader title={t('publishing.section.reviewerComments')} description={t('publishing.section.reviewerCommentsDescription')} />
          <div className="publishing-comment-list">
            {visibleComments.map((comment) => <article className="publishing-comment" key={comment.id}>
              <div className="publishing-card__actions"><strong><MessageSquareText size={15} /> {comment.reviewer} / {comment.commentId}</strong><Badge tone={reviewTone(comment.status)}>{labelEnum(comment.status)}</Badge></div>
              <blockquote>{comment.comment}</blockquote>
              <select value={comment.status} aria-label={t('submissions.a11y.updateCommentStatus', { id: comment.commentId })} onChange={(event) => void updateReviewerStatus(comment.id, event.target.value as ReviewerComment['status'])}>
                {REVIEW_COMMENT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
              </select>
            </article>)}
          </div>
        </section>}
      </section>

      <Modal open={manuscriptOpen} title={t('publishing.manuscriptDialog.title')} description={t('publishing.manuscriptDialog.description')} onClose={() => setManuscriptOpen(false)} size="lg" footer={<><Button onClick={() => setManuscriptOpen(false)}>{t('common.cancel')}</Button><Button variant="primary" type="submit" form="publishing-manuscript-form">{t('publishing.action.addManuscript')}</Button></>}>
        <form id="publishing-manuscript-form" className="form-grid" onSubmit={(event) => void saveManuscript(event)}>
          <Field label={t('publishing.manuscriptForm.title')} required className="form-span-2"><input autoFocus required value={manuscriptDraft.title} onChange={(event) => setManuscriptDraft({ ...manuscriptDraft, title: event.target.value })} /></Field>
          <Field label={t('publishing.manuscriptForm.project')} required><ProjectSelect required projects={data.projects} value={manuscriptDraft.projectId} onChange={(projectId) => setManuscriptDraft({ ...manuscriptDraft, projectId })} /></Field>
          <Field label={t('publishing.manuscriptForm.journal')} required><input required value={manuscriptDraft.targetJournal} onChange={(event) => setManuscriptDraft({ ...manuscriptDraft, targetJournal: event.target.value })} /></Field>
          <Field label={t('publishing.manuscriptForm.status')} required><select value={manuscriptDraft.status} onChange={(event) => setManuscriptDraft({ ...manuscriptDraft, status: event.target.value as Manuscript['status'] })}>{MANUSCRIPT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('publishing.manuscriptForm.wordCount')} required><input type="number" min="0" required value={manuscriptDraft.wordCount} onChange={(event) => setManuscriptDraft({ ...manuscriptDraft, wordCount: event.target.value })} /></Field>
          <Field label={t('publishing.manuscriptForm.nextAction')} className="form-span-2"><textarea rows={3} value={manuscriptDraft.nextAction} onChange={(event) => setManuscriptDraft({ ...manuscriptDraft, nextAction: event.target.value })} /></Field>
          <Field label={t('publishing.manuscriptForm.deadline')}><input type="date" value={manuscriptDraft.deadline} onChange={(event) => setManuscriptDraft({ ...manuscriptDraft, deadline: event.target.value })} /></Field>
        </form>
      </Modal>

      <Modal open={submissionOpen} title={t(resubmitting ? 'publishing.submissionDialog.resubmitTitle' : 'publishing.submissionDialog.title')} description={t('publishing.submissionDialog.description')} onClose={() => setSubmissionOpen(false)} size="lg" footer={<><Button onClick={() => setSubmissionOpen(false)}>{t('common.cancel')}</Button><Button variant="primary" type="submit" form="publishing-submission-form">{t(resubmitting ? 'publishing.action.resubmit' : 'publishing.action.addSubmission')}</Button></>}>
        <form id="publishing-submission-form" className="form-grid" onSubmit={(event) => void saveSubmission(event)}>
          <Field label={t('publishing.submissionForm.manuscript')} required className="form-span-2"><select autoFocus required value={submissionDraft.manuscriptId} onChange={(event) => { const manuscript = data.manuscripts.find((item) => item.id === event.target.value); setSubmissionDraft({ ...submissionDraft, manuscriptId: event.target.value, journal: manuscript?.targetJournal || submissionDraft.journal }) }}><option value="">{t('publishing.submissionForm.selectManuscript')}</option>{data.manuscripts.map((manuscript) => <option key={manuscript.id} value={manuscript.id}>{manuscript.title} · {projectName(manuscript.projectId)}</option>)}</select></Field>
          <Field label={t('publishing.submissionForm.journal')} required><input required value={submissionDraft.journal} onChange={(event) => setSubmissionDraft({ ...submissionDraft, journal: event.target.value })} /></Field>
          <Field label={t('publishing.submissionForm.version')} required><input required value={submissionDraft.manuscriptVersion} onChange={(event) => setSubmissionDraft({ ...submissionDraft, manuscriptVersion: event.target.value })} /></Field>
          <Field label={t('publishing.submissionForm.date')}><input type="date" value={submissionDraft.submissionDate} onChange={(event) => setSubmissionDraft({ ...submissionDraft, submissionDate: event.target.value })} /></Field>
          <Field label={t('publishing.submissionForm.status')} required><select value={submissionDraft.status} onChange={(event) => setSubmissionDraft({ ...submissionDraft, status: event.target.value as Submission['status'] })}>{SUBMISSION_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('publishing.submissionForm.editorialStatus')} className="form-span-2"><input value={submissionDraft.editorialStatus} onChange={(event) => setSubmissionDraft({ ...submissionDraft, editorialStatus: event.target.value })} /></Field>
          <Field label={t('publishing.submissionForm.decisionDate')}><input type="date" value={submissionDraft.decisionDate} onChange={(event) => setSubmissionDraft({ ...submissionDraft, decisionDate: event.target.value })} /></Field>
          <Field label={t('publishing.submissionForm.decision')}><input value={submissionDraft.decision} onChange={(event) => setSubmissionDraft({ ...submissionDraft, decision: event.target.value })} /></Field>
          <Field label={t('publishing.submissionForm.notes')} className="form-span-2"><textarea rows={4} value={submissionDraft.notes} onChange={(event) => setSubmissionDraft({ ...submissionDraft, notes: event.target.value })} /></Field>
        </form>
      </Modal>

      <Modal open={reviewerOpen} title={t('submissions.reviewDialog.title')} description={t('submissions.reviewDialog.description')} onClose={() => { setReviewerOpen(false); setReviewerError(false) }} size="lg" footer={<><Button onClick={() => setReviewerOpen(false)}>{t('common.cancel')}</Button><Button variant="primary" type="submit" form="publishing-reviewer-form">{t('submissions.reviewDialog.submit')}</Button></>}>
        <form id="publishing-reviewer-form" className="form-grid" onSubmit={(event) => void saveReviewer(event)}>
          <Field label={t('submissions.reviewForm.submission')} required className="form-span-2"><select autoFocus required value={reviewerDraft.submissionId} onChange={(event) => { setReviewerDraft({ ...reviewerDraft, submissionId: event.target.value }); setReviewerError(false) }}><option value="">{t('submissions.reviewForm.selectSubmission')}</option>{data.submissions.map((submission) => <option key={submission.id} value={submission.id}>{manuscriptName(submission.manuscriptId)} · {submission.journal} · {submission.manuscriptVersion}</option>)}</select></Field>
          <Field label={t('submissions.reviewForm.reviewer')} required><input required value={reviewerDraft.reviewer} onChange={(event) => setReviewerDraft({ ...reviewerDraft, reviewer: event.target.value })} /></Field>
          <Field label={t('submissions.reviewForm.commentId')} required><input required value={reviewerDraft.commentId} onChange={(event) => { setReviewerDraft({ ...reviewerDraft, commentId: event.target.value }); setReviewerError(false) }} /></Field>
          {reviewerError && <div className="app-error form-span-2" role="alert"><span>{t('submissions.validation.duplicateCommentId')}</span></div>}
          <Field label={t('submissions.reviewForm.severity')} required><select value={reviewerDraft.severity} onChange={(event) => setReviewerDraft({ ...reviewerDraft, severity: event.target.value as ReviewerComment['severity'] })}>{REVIEW_COMMENT_SEVERITIES.map((severity) => <option key={severity} value={severity}>{labelEnum(severity)}</option>)}</select></Field>
          <Field label={t('submissions.reviewForm.status')} required><select value={reviewerDraft.status} onChange={(event) => setReviewerDraft({ ...reviewerDraft, status: event.target.value as ReviewerComment['status'] })}>{REVIEW_COMMENT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('submissions.reviewForm.comment')} required className="form-span-2"><textarea required rows={5} value={reviewerDraft.comment} onChange={(event) => setReviewerDraft({ ...reviewerDraft, comment: event.target.value })} /></Field>
          <Field label={t('submissions.reviewForm.response')} className="form-span-2"><textarea rows={4} value={reviewerDraft.response} onChange={(event) => setReviewerDraft({ ...reviewerDraft, response: event.target.value })} /></Field>
          <Field label={t('submissions.reviewForm.revisionAction')} className="form-span-2"><textarea rows={3} value={reviewerDraft.revisionAction} onChange={(event) => setReviewerDraft({ ...reviewerDraft, revisionAction: event.target.value })} /></Field>
        </form>
      </Modal>
    </div>
  )
}
