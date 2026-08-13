import { describe, expect, it } from 'vitest'
import { createDemoWorkspace, isPristineDemoWorkspace } from './demo'
import { validateWorkspace } from '../utils/workspace-transfer'

describe('createDemoWorkspace', () => {
  const anchor = new Date('2026-04-10T09:30:00.000Z')

  it('creates a complete, relationally valid workspace', () => {
    const demo = createDemoWorkspace(anchor)
    const validation = validateWorkspace(demo)

    expect(validation.success).toBe(true)
    expect(demo.application).toBe('sociology-phd-desk')
    expect(demo.version).toBe(5)
    expect(demo.workspace.revision).toBe(0)
    expect(demo.workspace.todayGoals).toHaveLength(3)
    expect(demo.projects[0]?.method).toBe('Mixed Methods')
    expect(demo.literature).toHaveLength(3)
    expect(demo.interviews).toHaveLength(2)
    expect(demo.datasets).toHaveLength(1)
    expect(demo.manuscripts).toHaveLength(1)
    expect(demo.researchQuestions).toHaveLength(2)
    expect(demo.claims).toHaveLength(3)
    expect(demo.claimQuestionLinks).toHaveLength(3)
    expect(demo.theoryMemos).toHaveLength(2)
    expect(demo.literatureExternalReferences).toEqual([])
    expect('researchQuestion' in (demo.projects[0] ?? {})).toBe(false)
  })

  it('ships an explicit same-project graph without inferring evidence links', () => {
    const demo = createDemoWorkspace(anchor)
    const question = demo.researchQuestions[0]

    expect(question?.status).toBe('active')
    expect(demo.claims.every((claim) => claim.status === 'draft')).toBe(true)
    expect(
      demo.claimQuestionLinks.every((link) =>
        demo.researchQuestions.some(
          (candidate) =>
            candidate.id === link.researchQuestionId &&
            candidate.projectId === link.projectId,
        ),
      ),
    ).toBe(true)
    expect(
      demo.claimQuestionLinks.every((link) =>
        demo.claims.some(
          (claim) => claim.id === link.claimId && claim.projectId === link.projectId,
        ),
      ),
    ).toBe(true)
    expect(demo.evidence.map((item) => item.claim)).toEqual(
      expect.arrayContaining(
        demo.claims
          .filter((claim) => claim.projectId === question?.projectId)
          .map((claim) => claim.text),
      ),
    )
  })

  it('labels every bundled record as synthetic and includes no invented DOI', () => {
    const demo = createDemoWorkspace(anchor)
    const collections = [
      demo.projects,
      demo.researchQuestions,
      demo.claims,
      demo.claimQuestionLinks,
      demo.theoryMemos,
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

  it('ships synthetic theory memos with explicit same-project links only', () => {
    const demo = createDemoWorkspace(anchor)

    expect(demo.theoryMemos.map((memo) => memo.memoType)).toEqual([
      'concept',
      'mechanism',
    ])
    expect(
      demo.theoryMemos.every((memo) =>
        memo.relatedQuestionIds.every((id) =>
          demo.researchQuestions.some(
            (question) => question.id === id && question.projectId === memo.projectId,
          ),
        ),
      ),
    ).toBe(true)
    expect(
      demo.theoryMemos.every((memo) =>
        memo.relatedClaimIds.every((id) =>
          demo.claims.some((claim) => claim.id === id && claim.projectId === memo.projectId),
        ),
      ),
    ).toBe(true)
    expect(
      demo.tasks.some((task) => task.category === 'Theory / Conceptual Work'),
    ).toBe(true)
  })

  it('derives planning dates from the supplied anchor for deterministic tests', () => {
    const demo = createDemoWorkspace(anchor)

    expect(demo.exportedAt).toBe(anchor.toISOString())
    expect(demo.tasks.find((task) => task.id === 'demo-task-reading')?.dueDate).toBe('2026-04-10')
    expect(demo.tasks.find((task) => task.id === 'demo-task-analysis')?.dueDate).toBe('2026-04-11')
  })

  it('recognizes only the exact pristine fixture, independent of export time and row order', () => {
    const pristine = createDemoWorkspace(anchor)
    const reordered = structuredClone(pristine)
    reordered.exportedAt = '2026-08-12T00:00:00.000Z'
    reordered.tasks.reverse()

    expect(isPristineDemoWorkspace(pristine)).toBe(true)
    expect(isPristineDemoWorkspace(reordered)).toBe(true)

    const edited = structuredClone(pristine)
    edited.projects[0]!.notes = 'A user edit must be preserved as personal research.'
    expect(isPristineDemoWorkspace(edited)).toBe(false)
  })

  it('continues recognizing the historical pristine v3 demo after its empty v4 migration', () => {
    const historical = createDemoWorkspace(anchor)
    const theoryProjectIds = new Set(
      historical.theoryMemos.map((memo) => memo.projectId),
    )
    const theoryQuestionIds = new Set(
      historical.researchQuestions
        .filter((question) => theoryProjectIds.has(question.projectId))
        .map((question) => question.id),
    )
    const theoryClaimIds = new Set(
      historical.claims
        .filter((claim) => theoryProjectIds.has(claim.projectId))
        .map((claim) => claim.id),
    )
    historical.projects = historical.projects.filter(
      (project) => !theoryProjectIds.has(project.id),
    )
    historical.researchQuestions = historical.researchQuestions.filter(
      (question) => !theoryQuestionIds.has(question.id),
    )
    historical.claims = historical.claims.filter(
      (claim) => !theoryClaimIds.has(claim.id),
    )
    historical.claimQuestionLinks = historical.claimQuestionLinks.filter(
      (link) => !theoryProjectIds.has(link.projectId),
    )
    historical.tasks = historical.tasks.filter(
      (task) => !theoryProjectIds.has(task.projectId),
    )
    historical.theoryMemos = []

    expect(validateWorkspace(historical).success).toBe(true)
    expect(isPristineDemoWorkspace(historical)).toBe(true)

    historical.projects[0]!.notes = 'A historical fixture edit must be preserved.'
    expect(isPristineDemoWorkspace(historical)).toBe(false)
  })
})
