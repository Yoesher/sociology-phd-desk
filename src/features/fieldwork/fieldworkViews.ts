import type { Interview } from '../../models/domain'

export type FieldworkInterviewView =
  | 'overview'
  | 'sites'
  | 'visits'
  | 'interviews'
  | 'transcription'
  | 'coding'
  | 'memos'
  | 'completed'

export function matchesFieldworkInterviewView(
  item: Interview,
  view: FieldworkInterviewView,
): boolean {
  if (view === 'transcription' || view === 'coding' || view === 'memos') {
    if (item.status === 'Cancelled') return false
    const workProduct = view === 'transcription'
      ? item.transcriptStatus
      : view === 'coding'
        ? item.codingStatus
        : item.memoStatus
    return workProduct === 'Not Started' || workProduct === 'In Progress'
  }
  if (view === 'completed') {
    return item.status === 'Completed' &&
      [item.transcriptStatus, item.codingStatus, item.memoStatus].every(
        (status) => status === 'Complete' || status === 'Not Applicable',
      )
  }
  return true
}
