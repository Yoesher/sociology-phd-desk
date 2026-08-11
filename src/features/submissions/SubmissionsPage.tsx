import { useMemo, useState, type FormEvent } from 'react'
import { MessageSquareText, Send } from 'lucide-react'
import {
  REVIEW_COMMENT_SEVERITIES,
  REVIEW_COMMENT_STATUSES,
  SUBMISSION_STATUSES,
  type ReviewerComment,
  type Submission,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { entityMeta, projectLabel, truncate } from '../../app/format'
import { useI18n } from '../../i18n'
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
  StatCard,
  type Tone,
} from '../../components/ui'

type SubmissionTab = 'submissions' | 'review'

interface SubmissionDraft {
  projectId: string
  manuscriptId: string
  journal: string
  submissionDate: string
  manuscriptVersion: string
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

const emptySubmissionDraft = (): SubmissionDraft => ({
  projectId: '',
  manuscriptId: '',
  journal: '',
  submissionDate: '',
  manuscriptVersion: '',
  status: 'Preparing',
  editorialStatus: '',
  decisionDate: '',
  decision: '',
  notes: '',
})

const emptyReviewerDraft = (submissionId = ''): ReviewerDraft => ({
  submissionId,
  reviewer: '',
  commentId: '',
  comment: '',
  severity: 'Major',
  response: '',
  revisionAction: '',
  status: 'Open',
})

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

const severityTone = (severity: ReviewerComment['severity']): Tone => {
  if (severity === 'Critical') return 'danger'
  if (severity === 'Major') return 'warning'
  return 'neutral'
}

export function SubmissionsPage() {
  const { data, updateData } = useWorkspace()
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  const [tab, setTab] = useState<SubmissionTab>('submissions')
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('')
  const [reviewStatusFilter, setReviewStatusFilter] = useState('')
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [reviewerOpen, setReviewerOpen] = useState(false)
  const [submissionDraft, setSubmissionDraft] = useState<SubmissionDraft>(emptySubmissionDraft)
  const [reviewerDraft, setReviewerDraft] = useState<ReviewerDraft>(emptyReviewerDraft)
  const [reviewerError, setReviewerError] = useState(false)

  const recordCount = (count: number) => t(
    count === 1 ? 'submissions.count.recordsOne' : 'submissions.count.recordsOther',
    { count: formatNumber(count) },
  )
  const localizedProjectLabel = (projectId?: string) => {
    const project = data?.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase()
    const projects = data?.projects ?? []
    const manuscripts = data?.manuscripts ?? []
    return (data?.submissions ?? [])
      .filter((submission) => {
        const manuscript = manuscripts.find((item) => item.id === submission.manuscriptId)
        const corpus = [
          submission.journal,
          submission.manuscriptVersion,
          submission.editorialStatus,
          submission.decision,
          submission.notes,
          manuscript?.title || '',
          projectLabel(projects, submission.projectId),
        ]
          .join(' ')
          .toLowerCase()
        return (
          (!query || corpus.includes(query)) &&
          (!projectFilter || submission.projectId === projectFilter) &&
          (!submissionStatusFilter || submission.status === submissionStatusFilter)
        )
      })
      .sort((left, right) =>
        (right.submissionDate || right.updatedAt).localeCompare(left.submissionDate || left.updatedAt),
      )
  }, [
    data?.manuscripts,
    data?.projects,
    data?.submissions,
    projectFilter,
    search,
    submissionStatusFilter,
  ])

  const filteredComments = useMemo(() => {
    const query = search.trim().toLowerCase()
    const submissions = data?.submissions ?? []
    const manuscripts = data?.manuscripts ?? []
    return (data?.reviewerComments ?? [])
      .filter((comment) => {
        const submission = submissions.find((item) => item.id === comment.submissionId)
        const manuscript = manuscripts.find((item) => item.id === submission?.manuscriptId)
        const corpus = [
          comment.reviewer,
          comment.commentId,
          comment.comment,
          comment.response,
          comment.revisionAction,
          submission?.journal || '',
          manuscript?.title || '',
        ]
          .join(' ')
          .toLowerCase()
        return (
          (!query || corpus.includes(query)) &&
          (!projectFilter || submission?.projectId === projectFilter) &&
          (!reviewStatusFilter || comment.status === reviewStatusFilter)
        )
      })
      .sort((left, right) => {
        const severityOrder = { Critical: 0, Major: 1, Minor: 2 }
        return severityOrder[left.severity] - severityOrder[right.severity] ||
          right.updatedAt.localeCompare(left.updatedAt)
      })
  }, [
    data?.manuscripts,
    data?.reviewerComments,
    data?.submissions,
    projectFilter,
    reviewStatusFilter,
    search,
  ])

  if (!data) return null

  const submissionProjects = data.projects.filter((project) =>
    data.manuscripts.some((manuscript) => manuscript.projectId === project.id),
  )
  const validManuscripts = data.manuscripts.filter((manuscript) =>
    data.projects.some((project) => project.id === manuscript.projectId),
  )
  const validSubmissions = data.submissions.filter((submission) =>
    data.projects.some((project) => project.id === submission.projectId) &&
    data.manuscripts.some(
      (manuscript) =>
        manuscript.id === submission.manuscriptId &&
        manuscript.projectId === submission.projectId,
    ),
  )

  const openSubmission = () => {
    const preferred = validManuscripts.find(
      (manuscript) => manuscript.projectId === data.workspace.activeProjectId,
    ) || validManuscripts[0]
    if (!preferred) return
    setSubmissionDraft({
      ...emptySubmissionDraft(),
      projectId: preferred.projectId,
      manuscriptId: preferred.id,
      journal: preferred.targetJournal,
    })
    setSubmissionOpen(true)
  }

  const openReviewer = () => {
    const preferred = validSubmissions.find(
      (submission) => submission.projectId === (projectFilter || data.workspace.activeProjectId),
    ) || validSubmissions[0]
    if (!preferred) return
    setReviewerDraft(emptyReviewerDraft(preferred.id))
    setReviewerError(false)
    setReviewerOpen(true)
  }

  const saveSubmission = async (event: FormEvent) => {
    event.preventDefault()
    const projectExists = data.projects.some((project) => project.id === submissionDraft.projectId)
    const manuscriptExists = data.manuscripts.some(
      (manuscript) =>
        manuscript.id === submissionDraft.manuscriptId &&
        manuscript.projectId === submissionDraft.projectId,
    )
    if (!projectExists || !manuscriptExists) return

    const record: Submission = {
      ...entityMeta('submission'),
      projectId: submissionDraft.projectId,
      manuscriptId: submissionDraft.manuscriptId,
      journal: submissionDraft.journal.trim(),
      submissionDate: submissionDraft.submissionDate || undefined,
      manuscriptVersion: submissionDraft.manuscriptVersion.trim(),
      status: submissionDraft.status,
      editorialStatus: submissionDraft.editorialStatus.trim(),
      decisionDate: submissionDraft.decisionDate || undefined,
      decision: submissionDraft.decision.trim() || undefined,
      notes: submissionDraft.notes.trim(),
    }
    await updateData((current) => ({
      ...current,
      submissions: [record, ...current.submissions],
    }))
    setSubmissionOpen(false)
    setTab('submissions')
  }

  const saveReviewerComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!validSubmissions.some((submission) => submission.id === reviewerDraft.submissionId)) return
    const commentId = reviewerDraft.commentId.trim()
    if (data.reviewerComments.some(
      (comment) => comment.submissionId === reviewerDraft.submissionId && comment.commentId === commentId,
    )) {
      setReviewerError(true)
      return
    }

    const record: ReviewerComment = {
      ...entityMeta('review'),
      submissionId: reviewerDraft.submissionId,
      reviewer: reviewerDraft.reviewer.trim(),
      commentId,
      comment: reviewerDraft.comment.trim(),
      severity: reviewerDraft.severity,
      response: reviewerDraft.response.trim(),
      revisionAction: reviewerDraft.revisionAction.trim(),
      status: reviewerDraft.status,
    }
    await updateData((current) => ({
      ...current,
      reviewerComments: [record, ...current.reviewerComments],
    }))
    setReviewerError(false)
    setReviewerOpen(false)
    setTab('review')
  }

  const updateSubmissionStatus = async (id: string, status: Submission['status']) => {
    await updateData((current) => ({
      ...current,
      submissions: current.submissions.map((submission) =>
        submission.id === id
          ? { ...submission, status, updatedAt: new Date().toISOString() }
          : submission,
      ),
    }))
  }

  const updateReviewStatus = async (id: string, status: ReviewerComment['status']) => {
    await updateData((current) => ({
      ...current,
      reviewerComments: current.reviewerComments.map((comment) =>
        comment.id === id
          ? { ...comment, status, updatedAt: new Date().toISOString() }
          : comment,
      ),
    }))
  }

  const inReview = data.submissions.filter(
    (submission) => submission.status === 'Submitted' || submission.status === 'Under Review',
  ).length
  const decisions = data.submissions.filter(
    (submission) =>
      submission.status === 'Decision Received' ||
      submission.status === 'Accepted' ||
      submission.status === 'Rejected',
  ).length
  const openComments = data.reviewerComments.filter(
    (comment) => comment.status === 'Open' || comment.status === 'Addressing',
  ).length
  const resolvedComments = data.reviewerComments.filter(
    (comment) => comment.status === 'Resolved',
  ).length

  const clearFilters = () => {
    setSearch('')
    setProjectFilter('')
    setSubmissionStatusFilter('')
    setReviewStatusFilter('')
  }

  return (
    <div className="page">
      <PageHeader
        index="09"
        eyebrow={t('submissions.header.eyebrow')}
        title={t('submissions.header.title')}
        description={t('submissions.header.description')}
        actions={
          <div className="button-row">
            <Button
              onClick={openReviewer}
              disabled={!validSubmissions.length}
              title={!validSubmissions.length ? t('submissions.disabled.noSubmission') : undefined}
            >
              {t('submissions.action.addReviewerComment')}
            </Button>
            <AddButton
              onClick={openSubmission}
              disabled={!validManuscripts.length}
              title={!validManuscripts.length ? t('submissions.disabled.noManuscript') : undefined}
            >
              {t('submissions.action.addSubmission')}
            </AddButton>
          </div>
        }
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('submissions.stats.submissions.label')} value={formatNumber(data.submissions.length)} detail={t('submissions.stats.submissions.detail')} tone="blue" />
        <StatCard label={t('submissions.stats.review.label')} value={formatNumber(inReview)} detail={t('submissions.stats.review.detail')} tone="violet" />
        <StatCard label={t('submissions.stats.decisions.label')} value={formatNumber(decisions)} detail={t('submissions.stats.decisions.detail')} tone="success" />
        <StatCard label={t('submissions.stats.comments.label')} value={formatNumber(openComments)} detail={t(resolvedComments === 1 ? 'submissions.stats.comments.detailOne' : 'submissions.stats.comments.detailOther', { count: formatNumber(resolvedComments) })} tone={openComments ? 'warning' : 'neutral'} />
      </div>

      <section className="panel">
        <div className="segmented-tabs" role="tablist" aria-label={t('submissions.tabs.label')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'submissions'}
            className={tab === 'submissions' ? 'active' : ''}
            onClick={() => setTab('submissions')}
          >
            <Send size={15} /> {t('submissions.tabs.submissions')} <span>{formatNumber(data.submissions.length)}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'review'}
            className={tab === 'review' ? 'active' : ''}
            onClick={() => setTab('review')}
          >
            <MessageSquareText size={15} /> {t('submissions.tabs.review')} <span>{formatNumber(data.reviewerComments.length)}</span>
          </button>
        </div>

        <div className="toolbar toolbar--under-tabs toolbar--wrap">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t(tab === 'submissions' ? 'submissions.search.submissions' : 'submissions.search.review')}
          />
          <ProjectSelect
            projects={data.projects}
            value={projectFilter}
            onChange={setProjectFilter}
            includeAll
          />
          {tab === 'submissions' ? (
            <select
              value={submissionStatusFilter}
              onChange={(event) => setSubmissionStatusFilter(event.target.value)}
              aria-label={t('submissions.filter.submissionStatusLabel')}
            >
              <option value="">{t('submissions.filter.allSubmissionStatuses')}</option>
              {SUBMISSION_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
            </select>
          ) : (
            <select
              value={reviewStatusFilter}
              onChange={(event) => setReviewStatusFilter(event.target.value)}
              aria-label={t('submissions.filter.reviewStatusLabel')}
            >
              <option value="">{t('submissions.filter.allReviewStatuses')}</option>
              {REVIEW_COMMENT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
            </select>
          )}
          <span className="toolbar__count">
            {recordCount(tab === 'submissions' ? filteredSubmissions.length : filteredComments.length)}
          </span>
        </div>

        {tab === 'submissions' && (filteredSubmissions.length ? (
          <div className="data-table-wrap">
            <table className="data-table submissions-table">
              <thead>
                <tr>
                  <th>{t('submissions.table.manuscriptJournal')}</th>
                  <th>{t('submissions.table.projectVersion')}</th>
                  <th>{t('submissions.table.editorialDates')}</th>
                  <th>{t('submissions.table.editorialRecord')}</th>
                  <th>{t('submissions.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((submission) => {
                  const manuscript = data.manuscripts.find(
                    (item) => item.id === submission.manuscriptId,
                  )
                  return (
                    <tr key={submission.id}>
                      <td data-label={t('submissions.table.manuscriptJournal')}>
                        <span className="record-title">
                          <strong>{manuscript?.title || t('submissions.fallback.missingManuscript')}</strong>
                          <span>{submission.journal}</span>
                        </span>
                      </td>
                      <td data-label={t('submissions.table.projectVersion')}>
                        <span className="date-cell">
                          {localizedProjectLabel(submission.projectId)}
                          <small>{submission.manuscriptVersion}</small>
                        </span>
                      </td>
                      <td data-label={t('submissions.table.editorialDates')}>
                        <span className="date-cell">
                          {formatDate(submission.submissionDate, t('submissions.fallback.notSubmitted'))}
                          <small>{t('submissions.table.decisionDate', { date: formatDate(submission.decisionDate) })}</small>
                        </span>
                      </td>
                      <td data-label={t('submissions.table.editorialRecord')}>
                        <span className="record-title">
                          <strong>{submission.editorialStatus || t('submissions.fallback.noEditorialNote')}</strong>
                          <span>{truncate(submission.decision || submission.notes || t('submissions.fallback.noDecisionNotes'), 90)}</span>
                        </span>
                      </td>
                      <td data-label={t('submissions.table.status')}>
                        <select
                          value={submission.status}
                          onChange={(event) => void updateSubmissionStatus(
                            submission.id,
                            event.target.value as Submission['status'],
                          )}
                          aria-label={t('submissions.a11y.updateSubmissionStatus', { name: manuscript?.title || submission.journal })}
                        >
                          {SUBMISSION_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
                        </select>
                        <Badge tone={submissionTone(submission.status)}>{labelEnum(submission.status)}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={t(data.submissions.length ? 'submissions.empty.submissions.filteredTitle' : 'submissions.empty.submissions.initialTitle')}
            description={
              data.submissions.length
                ? t('submissions.empty.submissions.filteredDescription')
                : validManuscripts.length
                  ? t('submissions.empty.submissions.withManuscriptsDescription')
                  : t('submissions.empty.submissions.withoutManuscriptsDescription')
            }
            action={
              data.submissions.length
                ? <Button onClick={clearFilters}>{t('submissions.action.clearFilters')}</Button>
                : <AddButton onClick={openSubmission} disabled={!validManuscripts.length}>{t('submissions.action.addFirstSubmission')}</AddButton>
            }
          />
        ))}

        {tab === 'review' && (filteredComments.length ? (
          <div className="reviewer-matrix">
            {filteredComments.map((comment) => {
              const submission = data.submissions.find(
                (item) => item.id === comment.submissionId,
              )
              const manuscript = data.manuscripts.find(
                (item) => item.id === submission?.manuscriptId,
              )
              return (
                <article className="reviewer-comment-card" key={comment.id}>
                  <header>
                    <div>
                      <p className="eyebrow">{comment.reviewer} / {comment.commentId}</p>
                      <h3>{manuscript?.title || t('submissions.fallback.missingManuscript')}</h3>
                      <span>{submission?.journal || t('submissions.fallback.missingSubmission')} · {localizedProjectLabel(submission?.projectId)}</span>
                    </div>
                    <div className="badge-row">
                      <Badge tone={severityTone(comment.severity)}>{labelEnum(comment.severity)}</Badge>
                      <Badge tone={reviewTone(comment.status)}>{labelEnum(comment.status)}</Badge>
                    </div>
                  </header>
                  <blockquote>{comment.comment}</blockquote>
                  <dl className="reviewer-comment-card__work">
                    <div>
                      <dt>{t('submissions.review.response')}</dt>
                      <dd>{truncate(comment.response || t('submissions.review.noResponse'), 220)}</dd>
                    </div>
                    <div>
                      <dt>{t('submissions.review.revisionAction')}</dt>
                      <dd>{truncate(comment.revisionAction || t('submissions.review.noRevisionAction'), 220)}</dd>
                    </div>
                  </dl>
                  <Field label={t('submissions.review.commentStatus')} className="field--compact">
                    <select
                      value={comment.status}
                      onChange={(event) => void updateReviewStatus(
                        comment.id,
                        event.target.value as ReviewerComment['status'],
                      )}
                      aria-label={t('submissions.a11y.updateCommentStatus', { id: comment.commentId })}
                    >
                      {REVIEW_COMMENT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
                    </select>
                  </Field>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title={t(data.reviewerComments.length ? 'submissions.empty.review.filteredTitle' : 'submissions.empty.review.initialTitle')}
            description={
              data.reviewerComments.length
                ? t('submissions.empty.review.filteredDescription')
                : validSubmissions.length
                  ? t('submissions.empty.review.withSubmissionsDescription')
                  : t('submissions.empty.review.withoutSubmissionsDescription')
            }
            action={
              data.reviewerComments.length
                ? <Button onClick={clearFilters}>{t('submissions.action.clearFilters')}</Button>
                : <AddButton onClick={openReviewer} disabled={!validSubmissions.length}>{t('submissions.action.addFirstComment')}</AddButton>
            }
          />
        ))}
      </section>

      <Modal
        open={submissionOpen}
        title={t('submissions.submissionDialog.title')}
        description={t('submissions.submissionDialog.description')}
        onClose={() => setSubmissionOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setSubmissionOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="submission-form">{t('submissions.action.addSubmission')}</Button>
          </>
        }
      >
        <form id="submission-form" className="form-grid" onSubmit={(event) => void saveSubmission(event)}>
          <Field label={t('submissions.submissionForm.project')} required>
            <ProjectSelect
              required
              projects={submissionProjects}
              value={submissionDraft.projectId}
              onChange={(projectId) => {
                const manuscript = data.manuscripts.find((item) => item.projectId === projectId)
                setSubmissionDraft({
                  ...submissionDraft,
                  projectId,
                  manuscriptId: manuscript?.id || '',
                  journal: manuscript?.targetJournal || submissionDraft.journal,
                })
              }}
            />
          </Field>
          <Field label={t('submissions.submissionForm.manuscript')} required>
            <select
              required
              value={submissionDraft.manuscriptId}
              onChange={(event) => {
                const manuscript = data.manuscripts.find((item) => item.id === event.target.value)
                setSubmissionDraft({
                  ...submissionDraft,
                  manuscriptId: event.target.value,
                  journal: manuscript?.targetJournal || submissionDraft.journal,
                })
              }}
            >
              <option value="">{t('submissions.submissionForm.selectManuscript')}</option>
              {data.manuscripts
                .filter((manuscript) => manuscript.projectId === submissionDraft.projectId)
                .map((manuscript) => <option key={manuscript.id} value={manuscript.id}>{manuscript.title}</option>)}
            </select>
          </Field>
          <Field label={t('submissions.submissionForm.journal')} required>
            <input
              autoFocus
              required
              value={submissionDraft.journal}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, journal: event.target.value })}
            />
          </Field>
          <Field label={t('submissions.submissionForm.version')} required>
            <input
              required
              value={submissionDraft.manuscriptVersion}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, manuscriptVersion: event.target.value })}
              placeholder={t('submissions.submissionForm.versionPlaceholder')}
            />
          </Field>
          <Field label={t('submissions.submissionForm.date')}>
            <input
              type="date"
              value={submissionDraft.submissionDate}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, submissionDate: event.target.value })}
            />
          </Field>
          <Field label={t('submissions.submissionForm.status')} required>
            <select
              value={submissionDraft.status}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, status: event.target.value as Submission['status'] })}
            >
              {SUBMISSION_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
            </select>
          </Field>
          <Field label={t('submissions.submissionForm.editorialStatus')} className="form-span-2">
            <input
              value={submissionDraft.editorialStatus}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, editorialStatus: event.target.value })}
              placeholder={t('submissions.submissionForm.editorialStatusPlaceholder')}
            />
          </Field>
          <Field label={t('submissions.submissionForm.decisionDate')}>
            <input
              type="date"
              value={submissionDraft.decisionDate}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, decisionDate: event.target.value })}
            />
          </Field>
          <Field label={t('submissions.submissionForm.decision')}>
            <input
              value={submissionDraft.decision}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, decision: event.target.value })}
              placeholder={t('submissions.submissionForm.decisionPlaceholder')}
            />
          </Field>
          <Field label={t('submissions.submissionForm.notes')} className="form-span-2">
            <textarea
              rows={4}
              value={submissionDraft.notes}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, notes: event.target.value })}
              placeholder={t('submissions.submissionForm.notesPlaceholder')}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={reviewerOpen}
        title={t('submissions.reviewDialog.title')}
        description={t('submissions.reviewDialog.description')}
        onClose={() => {
          setReviewerOpen(false)
          setReviewerError(false)
        }}
        size="lg"
        footer={
          <>
            <Button onClick={() => setReviewerOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="reviewer-comment-form">{t('submissions.reviewDialog.submit')}</Button>
          </>
        }
      >
        <form id="reviewer-comment-form" className="form-grid" onSubmit={(event) => void saveReviewerComment(event)}>
          <Field label={t('submissions.reviewForm.submission')} required className="form-span-2">
            <select
              autoFocus
              required
              value={reviewerDraft.submissionId}
              onChange={(event) => {
                setReviewerDraft({ ...reviewerDraft, submissionId: event.target.value })
                setReviewerError(false)
              }}
            >
              <option value="">{t('submissions.reviewForm.selectSubmission')}</option>
              {validSubmissions.map((submission) => {
                const manuscript = data.manuscripts.find((item) => item.id === submission.manuscriptId)
                return (
                  <option key={submission.id} value={submission.id}>
                    {manuscript?.title} · {submission.journal} · {submission.manuscriptVersion}
                  </option>
                )
              })}
            </select>
          </Field>
          <Field label={t('submissions.reviewForm.reviewer')} required>
            <input
              required
              value={reviewerDraft.reviewer}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, reviewer: event.target.value })}
              placeholder={t('submissions.reviewForm.reviewerPlaceholder')}
            />
          </Field>
          <Field label={t('submissions.reviewForm.commentId')} required>
            <input
              required
              value={reviewerDraft.commentId}
              onChange={(event) => {
                setReviewerDraft({ ...reviewerDraft, commentId: event.target.value })
                setReviewerError(false)
              }}
              placeholder={t('submissions.reviewForm.commentIdPlaceholder')}
            />
          </Field>
          {reviewerError && (
            <div className="app-error form-span-2" role="alert">
              <span>{t('submissions.validation.duplicateCommentId')}</span>
            </div>
          )}
          <Field label={t('submissions.reviewForm.severity')} required>
            <select
              value={reviewerDraft.severity}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, severity: event.target.value as ReviewerComment['severity'] })}
            >
              {REVIEW_COMMENT_SEVERITIES.map((severity) => <option key={severity} value={severity}>{labelEnum(severity)}</option>)}
            </select>
          </Field>
          <Field label={t('submissions.reviewForm.status')} required>
            <select
              value={reviewerDraft.status}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, status: event.target.value as ReviewerComment['status'] })}
            >
              {REVIEW_COMMENT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
            </select>
          </Field>
          <Field label={t('submissions.reviewForm.comment')} required className="form-span-2">
            <textarea
              required
              rows={5}
              value={reviewerDraft.comment}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, comment: event.target.value })}
              placeholder={t('submissions.reviewForm.commentPlaceholder')}
            />
          </Field>
          <Field label={t('submissions.reviewForm.response')} className="form-span-2">
            <textarea
              rows={4}
              value={reviewerDraft.response}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, response: event.target.value })}
              placeholder={t('submissions.reviewForm.responsePlaceholder')}
            />
          </Field>
          <Field label={t('submissions.reviewForm.revisionAction')} className="form-span-2">
            <textarea
              rows={3}
              value={reviewerDraft.revisionAction}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, revisionAction: event.target.value })}
              placeholder={t('submissions.reviewForm.revisionActionPlaceholder')}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
