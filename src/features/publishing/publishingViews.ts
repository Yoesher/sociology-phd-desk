import type { Manuscript, ReviewerComment, Submission } from '../../models/domain'

export const PUBLISHING_VIEWS = [
  'all', 'draft', 'ready', 'submitted', 'review', 'revision',
  'rejected', 'accepted', 'published', 'withdrawn',
] as const

export type PublishingView = (typeof PUBLISHING_VIEWS)[number]

export const MANUSCRIPT_STATUSES_BY_VIEW: Readonly<Partial<Record<PublishingView, readonly Manuscript['status'][]>>> = {
  draft: ['Idea', 'Outline', 'Drafting', 'Internal Review'],
  ready: ['Ready to Submit'],
  review: ['Under Review'],
  revision: ['Revision'],
  rejected: ['Rejected', 'Reworking'],
  accepted: ['Accepted'],
  published: ['Published'],
}

export const SUBMISSION_STATUSES_BY_VIEW: Readonly<Partial<Record<PublishingView, readonly Submission['status'][]>>> = {
  ready: ['Preparing'],
  submitted: ['Submitted'],
  review: ['Under Review'],
  revision: ['Revision'],
  rejected: ['Rejected'],
  accepted: ['Accepted'],
  withdrawn: ['Withdrawn'],
}

export function normalizePublishingView(value: string | null): PublishingView {
  return PUBLISHING_VIEWS.includes(value as PublishingView) ? value as PublishingView : 'all'
}

export function manuscriptMatchesPublishingView(manuscript: Manuscript, view: PublishingView) {
  if (view === 'all') return true
  return MANUSCRIPT_STATUSES_BY_VIEW[view]?.includes(manuscript.status) ?? false
}

export function submissionMatchesPublishingView(submission: Submission, view: PublishingView) {
  if (view === 'all') return true
  return SUBMISSION_STATUSES_BY_VIEW[view]?.includes(submission.status) ?? false
}

export function isReviewerCommentUnresolved(comment: ReviewerComment) {
  return comment.status === 'Open' || comment.status === 'Addressing'
}

export function countUnresolvedReviewerComments(submissionId: string, comments: readonly ReviewerComment[]) {
  return comments.filter((comment) =>
    comment.submissionId === submissionId && isReviewerCommentUnresolved(comment),
  ).length
}

export function countPublishingView(
  view: PublishingView,
  manuscripts: readonly Manuscript[],
  submissions: readonly Submission[],
) {
  return manuscripts.filter((item) => manuscriptMatchesPublishingView(item, view)).length +
    submissions.filter((item) => submissionMatchesPublishingView(item, view)).length
}
