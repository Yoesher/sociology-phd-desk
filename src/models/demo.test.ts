import { describe, expect, it } from 'vitest'
import { createDemoWorkspace } from './demo'
import { validateWorkspace } from '../utils/workspace-transfer'

describe('createDemoWorkspace', () => {
  const anchor = new Date('2026-04-10T09:30:00.000Z')

  it('creates a complete, relationally valid workspace', () => {
    const demo = createDemoWorkspace(anchor)
    const validation = validateWorkspace(demo)

    expect(validation.success).toBe(true)
    expect(demo.application).toBe('sociology-phd-desk')
    expect(demo.version).toBe(3)
    expect(demo.workspace.revision).toBe(0)
    expect(demo.workspace.todayGoals).toHaveLength(3)
    expect(demo.projects[0]?.method).toBe('Mixed Methods')
    expect(demo.literature).toHaveLength(3)
    expect(demo.interviews).toHaveLength(2)
    expect(demo.datasets).toHaveLength(1)
    expect(demo.manuscripts).toHaveLength(1)
    expect(demo.researchQuestions).toHaveLength(1)
    expect(demo.claims).toHaveLength(2)
    expect(demo.claimQuestionLinks).toHaveLength(2)
    expect('researchQuestion' in (demo.projects[0] ?? {})).toBe(false)
  })

  it('ships an explicit same-project graph without inferring evidence links', () => {
    const demo = createDemoWorkspace(anchor)
    const question = demo.researchQuestions[0]

    expect(question?.status).toBe('active')
    expect(demo.claims.every((claim) => claim.status === 'draft')).toBe(true)
    expect(demo.claimQuestionLinks.every((link) => link.projectId === question?.projectId)).toBe(true)
    expect(
      demo.claimQuestionLinks.every((link) =>
        demo.claims.some(
          (claim) => claim.id === link.claimId && claim.projectId === link.projectId,
        ),
      ),
    ).toBe(true)
    expect(
      demo.claimQuestionLinks.every((link) => link.researchQuestionId === question?.id),
    ).toBe(true)
    expect(demo.evidence.map((item) => item.claim)).toEqual(
      expect.arrayContaining(demo.claims.map((claim) => claim.text)),
    )
  })

  it('labels every bundled record as synthetic and includes no invented DOI', () => {
    const demo = createDemoWorkspace(anchor)
    const collections = [
      demo.projects,
      demo.researchQuestions,
      demo.claims,
      demo.claimQuestionLinks,
      demo.tasks,
      demo.literature,
      demo.fieldSites,
      demo.interviews,
      demo.fieldVisits,
      demo.datasets,
      demo.analysisRuns,
      demo.evidence,
      demo.researchLogs,
      demo.manuscripts,
      demo.submissions,
      demo.reviewerComments,
    ]

    expect(demo.workspace.isDemo).toBe(true)
    expect(collections.every((records) => records.every((record) => record.isDemo))).toBe(true)
    expect(demo.literature.every((item) => item.doi === undefined)).toBe(true)
    expect(demo.interviews.every((interview) => interview.status === 'Planned')).toBe(true)
    expect(demo.analysisRuns.every((run) => run.status === 'Planned')).toBe(true)
    expect(demo.analysisRuns[0]?.resultSummary).toContain('No result')
  })

  it('derives planning dates from the supplied anchor for deterministic tests', () => {
    const demo = createDemoWorkspace(anchor)

    expect(demo.exportedAt).toBe(anchor.toISOString())
    expect(demo.tasks.find((task) => task.id === 'demo-task-reading')?.dueDate).toBe('2026-04-10')
    expect(demo.tasks.find((task) => task.id === 'demo-task-analysis')?.dueDate).toBe('2026-04-11')
  })
})
