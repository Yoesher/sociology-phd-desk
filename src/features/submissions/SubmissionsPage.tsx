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
import { entityMeta, formatDate, projectLabel, truncate } from '../../app/format'
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
  const [tab, setTab] = useState<SubmissionTab>('submissions')
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('')
  const [reviewStatusFilter, setReviewStatusFilter] = useState('')
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [reviewerOpen, setReviewerOpen] = useState(false)
  const [submissionDraft, setSubmissionDraft] = useState<SubmissionDraft>(emptySubmissionDraft)
  const [reviewerDraft, setReviewerDraft] = useState<ReviewerDraft>(emptyReviewerDraft)
  const [reviewerError, setReviewerError] = useState<string | null>(null)

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
    setReviewerError(null)
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
      setReviewerError('This comment ID already exists for the selected submission. Use a unique reviewer-comment ID.')
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
    setReviewerError(null)
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
        eyebrow="Editorial record"
        title="Submissions & peer review"
        description="Keep journal states, manuscript versions, reviewer claims, responses, and revision actions in one traceable record."
        actions={
          <div className="button-row">
            <Button
              onClick={openReviewer}
              disabled={!validSubmissions.length}
              title={!validSubmissions.length ? 'Add a valid submission before recording reviewer comments.' : undefined}
            >
              Add reviewer comment
            </Button>
            <AddButton
              onClick={openSubmission}
              disabled={!validManuscripts.length}
              title={!validManuscripts.length ? 'Add a project-linked manuscript before creating a submission.' : undefined}
            >
              Add submission
            </AddButton>
          </div>
        }
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label="Submissions" value={data.submissions.length} detail="complete editorial records" tone="blue" />
        <StatCard label="In review" value={inReview} detail="submitted or under review" tone="violet" />
        <StatCard label="Decisions" value={decisions} detail="decision record received" tone="success" />
        <StatCard label="Open comments" value={openComments} detail={`${resolvedComments} resolved`} tone={openComments ? 'warning' : 'neutral'} />
      </div>

      <section className="panel">
        <div className="segmented-tabs" role="tablist" aria-label="Editorial workflow">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'submissions'}
            className={tab === 'submissions' ? 'active' : ''}
            onClick={() => setTab('submissions')}
          >
            <Send size={15} /> Submissions <span>{data.submissions.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'review'}
            className={tab === 'review' ? 'active' : ''}
            onClick={() => setTab('review')}
          >
            <MessageSquareText size={15} /> Reviewer matrix <span>{data.reviewerComments.length}</span>
          </button>
        </div>

        <div className="toolbar toolbar--under-tabs toolbar--wrap">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={tab === 'submissions' ? 'Search journal, manuscript, version, or decision' : 'Search reviewer, comment, response, or action'}
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
              aria-label="Filter by submission status"
            >
              <option value="">All submission statuses</option>
              {SUBMISSION_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          ) : (
            <select
              value={reviewStatusFilter}
              onChange={(event) => setReviewStatusFilter(event.target.value)}
              aria-label="Filter by reviewer comment status"
            >
              <option value="">All review statuses</option>
              {REVIEW_COMMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          )}
          <span className="toolbar__count">
            {tab === 'submissions' ? filteredSubmissions.length : filteredComments.length} records
          </span>
        </div>

        {tab === 'submissions' && (filteredSubmissions.length ? (
          <div className="data-table-wrap">
            <table className="data-table submissions-table">
              <thead>
                <tr>
                  <th>Manuscript / journal</th>
                  <th>Project / version</th>
                  <th>Editorial dates</th>
                  <th>Editorial record</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((submission) => {
                  const manuscript = data.manuscripts.find(
                    (item) => item.id === submission.manuscriptId,
                  )
                  return (
                    <tr key={submission.id}>
                      <td data-label="Manuscript / journal">
                        <span className="record-title">
                          <strong>{manuscript?.title || 'Missing manuscript record'}</strong>
                          <span>{submission.journal}</span>
                        </span>
                      </td>
                      <td data-label="Project / version">
                        <span className="date-cell">
                          {projectLabel(data.projects, submission.projectId)}
                          <small>{submission.manuscriptVersion}</small>
                        </span>
                      </td>
                      <td data-label="Editorial dates">
                        <span className="date-cell">
                          {formatDate(submission.submissionDate, 'Not submitted')}
                          <small>Decision: {formatDate(submission.decisionDate)}</small>
                        </span>
                      </td>
                      <td data-label="Editorial record">
                        <span className="record-title">
                          <strong>{submission.editorialStatus || 'No editorial note'}</strong>
                          <span>{truncate(submission.decision || submission.notes || 'No decision or notes recorded.', 90)}</span>
                        </span>
                      </td>
                      <td data-label="Status">
                        <select
                          value={submission.status}
                          onChange={(event) => void updateSubmissionStatus(
                            submission.id,
                            event.target.value as Submission['status'],
                          )}
                          aria-label={`Update submission status for ${manuscript?.title || submission.journal}`}
                        >
                          {SUBMISSION_STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </select>
                        <Badge tone={submissionTone(submission.status)}>{submission.status}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={data.submissions.length ? 'No submissions match these filters' : 'No journal submissions recorded'}
            description={
              data.submissions.length
                ? 'Clear one or more filters to restore the editorial record.'
                : validManuscripts.length
                  ? 'Create a submission from a real project-linked manuscript.'
                  : 'Add a project-linked manuscript before creating its submission record.'
            }
            action={
              data.submissions.length
                ? <Button onClick={clearFilters}>Clear filters</Button>
                : <AddButton onClick={openSubmission} disabled={!validManuscripts.length}>Add first submission</AddButton>
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
                      <h3>{manuscript?.title || 'Missing manuscript record'}</h3>
                      <span>{submission?.journal || 'Missing submission record'} · {projectLabel(data.projects, submission?.projectId)}</span>
                    </div>
                    <div className="badge-row">
                      <Badge tone={severityTone(comment.severity)}>{comment.severity}</Badge>
                      <Badge tone={reviewTone(comment.status)}>{comment.status}</Badge>
                    </div>
                  </header>
                  <blockquote>{comment.comment}</blockquote>
                  <dl className="reviewer-comment-card__work">
                    <div>
                      <dt>Response</dt>
                      <dd>{truncate(comment.response || 'Response not drafted.', 220)}</dd>
                    </div>
                    <div>
                      <dt>Revision action</dt>
                      <dd>{truncate(comment.revisionAction || 'Revision action not defined.', 220)}</dd>
                    </div>
                  </dl>
                  <Field label="Comment status" className="field--compact">
                    <select
                      value={comment.status}
                      onChange={(event) => void updateReviewStatus(
                        comment.id,
                        event.target.value as ReviewerComment['status'],
                      )}
                      aria-label={`Update status for reviewer comment ${comment.commentId}`}
                    >
                      {REVIEW_COMMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </Field>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title={data.reviewerComments.length ? 'No reviewer comments match these filters' : 'No reviewer comments recorded'}
            description={
              data.reviewerComments.length
                ? 'Clear one or more filters to restore the revision matrix.'
                : validSubmissions.length
                  ? 'Turn each reviewer claim into a response and an explicit revision action.'
                  : 'Add a valid submission before recording peer-review work.'
            }
            action={
              data.reviewerComments.length
                ? <Button onClick={clearFilters}>Clear filters</Button>
                : <AddButton onClick={openReviewer} disabled={!validSubmissions.length}>Add first comment</AddButton>
            }
          />
        ))}
      </section>

      <Modal
        open={submissionOpen}
        title="Add a submission"
        description="Link the exact manuscript version and retain the journal's editorial state as a separate record."
        onClose={() => setSubmissionOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setSubmissionOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="submission-form">Add submission</Button>
          </>
        }
      >
        <form id="submission-form" className="form-grid" onSubmit={(event) => void saveSubmission(event)}>
          <Field label="Project" required>
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
          <Field label="Manuscript" required>
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
              <option value="">Select a manuscript</option>
              {data.manuscripts
                .filter((manuscript) => manuscript.projectId === submissionDraft.projectId)
                .map((manuscript) => <option key={manuscript.id} value={manuscript.id}>{manuscript.title}</option>)}
            </select>
          </Field>
          <Field label="Journal" required>
            <input
              autoFocus
              required
              value={submissionDraft.journal}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, journal: event.target.value })}
            />
          </Field>
          <Field label="Manuscript version" required>
            <input
              required
              value={submissionDraft.manuscriptVersion}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, manuscriptVersion: event.target.value })}
              placeholder="e.g. v1.2, clean submission copy"
            />
          </Field>
          <Field label="Submission date">
            <input
              type="date"
              value={submissionDraft.submissionDate}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, submissionDate: event.target.value })}
            />
          </Field>
          <Field label="Submission status" required>
            <select
              value={submissionDraft.status}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, status: event.target.value as Submission['status'] })}
            >
              {SUBMISSION_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="Editorial status" className="form-span-2">
            <input
              value={submissionDraft.editorialStatus}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, editorialStatus: event.target.value })}
              placeholder="Journal-specific state, editor note, or portal label"
            />
          </Field>
          <Field label="Decision date">
            <input
              type="date"
              value={submissionDraft.decisionDate}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, decisionDate: event.target.value })}
            />
          </Field>
          <Field label="Decision">
            <input
              value={submissionDraft.decision}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, decision: event.target.value })}
              placeholder="Use the journal's exact decision category"
            />
          </Field>
          <Field label="Notes" className="form-span-2">
            <textarea
              rows={4}
              value={submissionDraft.notes}
              onChange={(event) => setSubmissionDraft({ ...submissionDraft, notes: event.target.value })}
              placeholder="Scope, correspondence, constraints, or next editorial checkpoint"
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={reviewerOpen}
        title="Add a reviewer comment"
        description="Keep the source comment distinct from your response and the concrete manuscript change."
        onClose={() => {
          setReviewerOpen(false)
          setReviewerError(null)
        }}
        size="lg"
        footer={
          <>
            <Button onClick={() => setReviewerOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="reviewer-comment-form">Add comment</Button>
          </>
        }
      >
        <form id="reviewer-comment-form" className="form-grid" onSubmit={(event) => void saveReviewerComment(event)}>
          <Field label="Submission" required className="form-span-2">
            <select
              autoFocus
              required
              value={reviewerDraft.submissionId}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, submissionId: event.target.value })}
            >
              <option value="">Select a submission</option>
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
          <Field label="Reviewer label" required>
            <input
              required
              value={reviewerDraft.reviewer}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, reviewer: event.target.value })}
              placeholder="e.g. Reviewer 2 or Editor"
            />
          </Field>
          <Field label="Comment ID" required>
            <input
              required
              value={reviewerDraft.commentId}
              onChange={(event) => {
                setReviewerDraft({ ...reviewerDraft, commentId: event.target.value })
                setReviewerError(null)
              }}
              placeholder="e.g. R2-C04"
            />
          </Field>
          {reviewerError && (
            <div className="app-error form-span-2" role="alert">
              <span>{reviewerError}</span>
            </div>
          )}
          <Field label="Severity" required>
            <select
              value={reviewerDraft.severity}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, severity: event.target.value as ReviewerComment['severity'] })}
            >
              {REVIEW_COMMENT_SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
            </select>
          </Field>
          <Field label="Status" required>
            <select
              value={reviewerDraft.status}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, status: event.target.value as ReviewerComment['status'] })}
            >
              {REVIEW_COMMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="Reviewer comment" required className="form-span-2">
            <textarea
              required
              rows={5}
              value={reviewerDraft.comment}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, comment: event.target.value })}
              placeholder="Transcribe or accurately summarize one discrete reviewer claim."
            />
          </Field>
          <Field label="Response" className="form-span-2">
            <textarea
              rows={4}
              value={reviewerDraft.response}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, response: event.target.value })}
              placeholder="Draft the substantive response or rationale for declining the request."
            />
          </Field>
          <Field label="Revision action" className="form-span-2">
            <textarea
              rows={3}
              value={reviewerDraft.revisionAction}
              onChange={(event) => setReviewerDraft({ ...reviewerDraft, revisionAction: event.target.value })}
              placeholder="Name the exact manuscript, analysis, or appendix change."
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
