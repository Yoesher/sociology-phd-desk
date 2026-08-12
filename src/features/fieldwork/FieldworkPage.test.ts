import { describe, expect, it } from 'vitest'
import type { Interview } from '../../models/domain'
import { legacyRouteRedirects } from '../../app/legacyRoutes'
import { matchesFieldworkInterviewView } from './fieldworkViews'

const interview: Interview = {
  id: 'synthetic-interview',
  projectId: 'synthetic-project',
  participantAlias: 'SYNTHETIC participant',
  status: 'Completed',
  transcriptStatus: 'Complete',
  codingStatus: 'Not Applicable',
  memoStatus: 'Not Applicable',
  notes: '',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
  isDemo: false,
}

describe('fieldwork smart-view boundaries', () => {
  it('treats Not Applicable as terminal and never queues cancelled interviews', () => {
    expect(matchesFieldworkInterviewView(interview, 'completed')).toBe(true)
    expect(matchesFieldworkInterviewView({
      ...interview,
      status: 'Cancelled',
      transcriptStatus: 'Not Started',
      codingStatus: 'In Progress',
      memoStatus: 'Not Started',
    }, 'transcription')).toBe(false)
  })

  it('keeps legacy manuscript and submission bookmarks on the complete publishing history', () => {
    expect(legacyRouteRedirects).toEqual({
      manuscripts: '/publishing?view=all',
      submissions: '/publishing?view=all',
    })
  })
})
