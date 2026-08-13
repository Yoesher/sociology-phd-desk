import type { Manuscript, ReviewerComment, Submission } from '../../models/domain'

export const PUBLISHING_VIEWS = ['writing', 'submission', 'revision', 'history'] as const
export type PublishingView = (typeof PUBLISHING_VIEWS)[number]

export const MANUSCRIPT_STATUSES_BY_VIEW: Readonly<Record<PublishingView, readonly Manuscript['status'][]>> = {
  writing: ['Idea', 'Outline', 'Drafting', 'Internal Review', 'Ready to Submit'],
  submission: ['Submitted', 'Under Review'],
  revision: ['Revision'],
  history: ['Rejected', 'Reworking', 'Accepted', 'Published'],
}

export const SUBMISSION_STATUSES_BY_VIEW: Readonly<Record<PublishingView, readonly Submission['status'][]>> = {
  writing: ['Preparing'],
  submission: ['Submitted', 'Under Review'],
  revision: ['Revision'],
  history: ['Rejected', 'Decision Received', 'Accepted', 'Withdrawn'],
}

export function normalizePublishingView(value: string | null): PublishingView {
  return PUBLISHING_VIEWS.includes(value as PublishingView) ? value as PublishingView : 'writing'
}

export function manuscriptMatchesPublishingView(manuscript: Manuscript, view: PublishingView, statuses: readonly string[] = []) {
  return MANUSCRIPT_STATUSES_BY_VIEW[view].includes(manuscript.status) && (!statuses.length || statuses.includes(manuscript.status))
}

export function submissionMatchesPublishingView(submission: Submission, view: PublishingView, statuses: readonly string[] = []) {
  return SUBMISSION_STATUSES_BY_VIEW[view].includes(submission.status) && (!statuses.length || statuses.includes(submission.status))
}

export function isReviewerCommentUnresolved(comment: ReviewerComment) {
  return comment.status === 'Open' || comment.status === 'Addressing'
}

export function countUnresolvedReviewerComments(submissionId: string, comments: readonly ReviewerComment[]) {
  return comments.filter((comment) => comment.submissionId === submissionId && isReviewerCommentUnresolved(comment)).length
}

export function countPublishingView(view: PublishingView, manuscripts: readonly Manuscript[], submissions: readonly Submission[]) {
  return manuscripts.filter((item) => manuscriptMatchesPublishingView(item, view)).length +
    submissions.filter((item) => submissionMatchesPublishingView(item, view)).length
}
