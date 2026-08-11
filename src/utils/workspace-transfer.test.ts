import { describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import {
  WorkspaceValidationError,
  exportWorkspaceJson,
  importWorkspaceJson,
  migrateWorkspaceV1ToV2,
  migrateWorkspaceV2ToV3,
  validateWorkspace,
} from './workspace-transfer'

const anchor = new Date('2026-04-10T09:30:00.000Z')

function createLegacyV2Envelope(): Record<string, unknown> {
  const current = createDemoWorkspace(anchor)
  const questionByProject = new Map(
    current.researchQuestions.map((question) => [question.projectId, question.text]),
  )
  const legacy = structuredClone(current) as unknown as Record<string, unknown>
  legacy['version'] = 2
  legacy['projects'] = current.projects.map((project) => ({
    ...project,
    researchQuestion: questionByProject.get(project.id) ?? '',
  }))
  delete legacy['researchQuestions']
  delete legacy['claims']
  delete legacy['claimQuestionLinks']
  return legacy
}

describe('workspace JSON transfer', () => {
  it('round-trips every workspace collection', () => {
    const demo = createDemoWorkspace(anchor)
    const json = exportWorkspaceJson(demo)
    const imported = importWorkspaceJson(json)

    expect(imported.workspace).toEqual(demo.workspace)
    expect(imported.projects).toEqual(demo.projects)
    expect(imported.researchQuestions).toEqual(demo.researchQuestions)
    expect(imported.claims).toEqual(demo.claims)
    expect(imported.claimQuestionLinks).toEqual(demo.claimQuestionLinks)
    expect(imported.evidence).toEqual(demo.evidence)
    expect(imported.reviewerComments).toEqual(demo.reviewerComments)
    expect(new Date(imported.exportedAt).toString()).not.toBe('Invalid Date')
  })

  it('imports v1 through the explicit v1-to-v2-to-v3 migration chain', () => {
    const legacy = createLegacyV2Envelope()
    legacy['version'] = 1
    delete legacy['application']
    const legacyWorkspace = legacy['workspace'] as Record<string, unknown>
    delete legacyWorkspace['revision']

    const imported = importWorkspaceJson(JSON.stringify(legacy))

    expect(imported.version).toBe(3)
    expect(imported.application).toBe('sociology-phd-desk')
    expect(imported.workspace.revision).toBe(0)
    expect(imported.projects).toHaveLength(1)
    expect(imported.interviews).toHaveLength(2)
    expect(imported.researchQuestions).toHaveLength(1)
    expect(imported.claims).toHaveLength(2)
    expect(imported.claimQuestionLinks).toEqual([])
    expect('researchQuestion' in (imported.projects[0] ?? {})).toBe(false)

    const v2 = migrateWorkspaceV1ToV2(legacy) as Record<string, unknown>
    expect(v2['version']).toBe(2)
    expect(v2['researchQuestions']).toBeUndefined()
    const v3 = migrateWorkspaceV2ToV3(v2) as Record<string, unknown>
    expect(v3['version']).toBe(3)
    expect(Array.isArray(v3['researchQuestions'])).toBe(true)
  })

  it('migrates legacy text deterministically without rewriting evidence or inferring links', () => {
    const legacy = createLegacyV2Envelope()
    const projects = legacy['projects'] as Array<Record<string, unknown>>
    const evidence = legacy['evidence'] as Array<Record<string, unknown>>
    const firstProject = projects[0]
    const firstEvidence = evidence[0]
    if (!firstProject || !firstEvidence) {
      throw new Error('Expected legacy demo records.')
    }

    const secondProject = {
      ...firstProject,
      id: 'legacy-project-b',
      title: 'Legacy project B',
      shortTitle: 'Project B',
      researchQuestion: '  A second exact question?  ',
    }
    legacy['projects'] = [firstProject, secondProject]
    legacy['evidence'] = [
      { ...firstEvidence, id: 'legacy-evidence-a1', claim: '  Exact claim text  ' },
      { ...firstEvidence, id: 'legacy-evidence-a2', claim: 'Exact claim text' },
      { ...firstEvidence, id: 'legacy-evidence-case', claim: 'exact claim text' },
      {
        ...firstEvidence,
        id: 'legacy-evidence-b',
        projectId: 'legacy-project-b',
        claim: 'Exact claim text',
      },
    ]

    const imported = importWorkspaceJson(JSON.stringify(legacy))
    const reordered = structuredClone(legacy)
    ;(reordered['evidence'] as unknown[]).reverse()
    const reorderedImport = importWorkspaceJson(JSON.stringify(reordered))

    expect(imported.evidence.map((item) => item.claim)).toEqual([
      '  Exact claim text  ',
      'Exact claim text',
      'exact claim text',
      'Exact claim text',
    ])
    expect(imported.claims).toHaveLength(3)
    expect(
      imported.claims.filter(
        (claim) =>
          claim.projectId === String(firstProject['id']) && claim.text === 'Exact claim text',
      ),
    ).toHaveLength(1)
    expect(
      imported.claims.some(
        (claim) =>
          claim.projectId === String(firstProject['id']) && claim.text === 'exact claim text',
      ),
    ).toBe(true)
    expect(
      imported.claims.some(
        (claim) => claim.projectId === 'legacy-project-b' && claim.text === 'Exact claim text',
      ),
    ).toBe(true)
    expect(imported.researchQuestions.some((question) => question.text === 'A second exact question?')).toBe(true)
    expect(imported.claimQuestionLinks).toEqual([])
    expect(
      reorderedImport.claims
        .map((claim) => [claim.projectId, claim.text, claim.id])
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    ).toEqual(
      imported.claims
        .map((claim) => [claim.projectId, claim.text, claim.id])
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    )
  })

  it('rejects an ambiguous v2 envelope that already contains graph collections', () => {
    const legacy = createLegacyV2Envelope()
    legacy['claims'] = []

    const result = validateWorkspace(legacy)

    expect(result.success).toBe(false)
  })

  it.each([
    ['missing', undefined],
    ['non-string', { unexpected: 'object' }],
  ])('rejects a v2 project with a %s legacy research question', (_label, value) => {
    const legacy = createLegacyV2Envelope()
    const projects = legacy['projects'] as Array<Record<string, unknown>>
    const project = projects[0]
    if (!project) {
      throw new Error('Expected a legacy project.')
    }
    if (value === undefined) {
      delete project['researchQuestion']
    } else {
      project['researchQuestion'] = value
    }

    const result = validateWorkspace(legacy)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.path.join('.') === 'version')).toBe(true)
    }
  })

  it('returns actionable syntax errors without writing data', () => {
    expect(() => importWorkspaceJson('{not-json')).toThrow(WorkspaceValidationError)

    try {
      importWorkspaceJson('{not-json')
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceValidationError)
      expect((error as WorkspaceValidationError).issues).toEqual([
        { path: [], message: 'Invalid JSON syntax.' },
      ])
    }
  })

  it('rejects unsupported properties instead of silently dropping them', () => {
    const input = structuredClone(createDemoWorkspace(anchor)) as unknown as Record<string, unknown>
    input['futureUnsupportedField'] = true

    const result = validateWorkspace(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.message.includes('Unrecognized key'))).toBe(true)
    }
  })

  it('rejects workspace files produced by a different application', () => {
    const input = structuredClone(createDemoWorkspace(anchor)) as unknown as {
      application: string
    }
    input.application = 'another-application'

    const result = validateWorkspace(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.path.join('.') === 'application')).toBe(true)
    }
  })

  it('rejects negative workspace revisions', () => {
    const input = structuredClone(createDemoWorkspace(anchor))
    input.workspace.revision = -1

    const result = validateWorkspace(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.path.join('.') === 'workspace.revision')).toBe(true)
    }
  })

  it('allows a manuscript target journal to remain genuinely undecided', () => {
    const input = structuredClone(createDemoWorkspace(anchor))
    const manuscript = input.manuscripts[0]
    if (!manuscript) {
      throw new Error('Expected a demo manuscript.')
    }
    manuscript.targetJournal = ''

    const exported = exportWorkspaceJson(input)
    const imported = importWorkspaceJson(exported)

    expect(imported.manuscripts[0]?.targetJournal).toBe('')
  })

  it('rejects duplicate IDs', () => {
    const input = structuredClone(createDemoWorkspace(anchor))
    const firstTask = input.tasks[0]
    if (!firstTask) {
      throw new Error('Expected the demo workspace to contain a task.')
    }
    input.tasks.push({ ...firstTask })

    const result = validateWorkspace(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toContainEqual({
        path: ['tasks', input.tasks.length - 1, 'id'],
        message: `Duplicate ID "${firstTask.id}" in tasks.`,
      })
    }
  })

  it('rejects dangling and cross-project research relationships', () => {
    const input = structuredClone(createDemoWorkspace(anchor))
    const interview = input.interviews[0]
    const analysisRun = input.analysisRuns[0]
    if (!interview || !analysisRun) {
      throw new Error('Expected relational demo records.')
    }
    interview.fieldSiteId = 'missing-field-site'
    analysisRun.datasetId = 'missing-dataset'

    const result = validateWorkspace(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['interviews.0.fieldSiteId', 'analysisRuns.0.datasetId']),
      )
    }
  })

  it('rejects dangling, cross-project, and duplicate claim-question links', () => {
    const input = structuredClone(createDemoWorkspace(anchor))
    const project = input.projects[0]
    const link = input.claimQuestionLinks[0]
    if (!project || !link) {
      throw new Error('Expected demo graph records.')
    }
    input.projects.push({
      ...project,
      id: 'graph-project-b',
      title: 'Graph project B',
      shortTitle: 'Graph B',
    })
    input.claimQuestionLinks.push({ ...link, id: 'duplicate-graph-link' })
    input.claimQuestionLinks.push({
      ...link,
      id: 'dangling-graph-link',
      claimId: 'missing-claim',
    })
    input.claimQuestionLinks.push({
      ...link,
      id: 'cross-project-graph-link',
      projectId: 'graph-project-b',
    })

    const result = validateWorkspace(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.issues.map((issue) => issue.path.join('.'))
      expect(paths).toEqual(
        expect.arrayContaining([
          'claimQuestionLinks.3.claimId',
          'claimQuestionLinks.4.claimId',
          'claimQuestionLinks.4.researchQuestionId',
        ]),
      )
      expect(
        result.issues.some((issue) =>
          issue.message.includes('already linked to this research question'),
        ),
      ).toBe(true)
    }
  })

  it('protects graph parents from deletion while links still reference them', () => {
    const missingClaim = structuredClone(createDemoWorkspace(anchor))
    missingClaim.claims = missingClaim.claims.slice(1)
    const missingQuestion = structuredClone(createDemoWorkspace(anchor))
    missingQuestion.researchQuestions = []

    const claimResult = validateWorkspace(missingClaim)
    const questionResult = validateWorkspace(missingQuestion)

    expect(claimResult.success).toBe(false)
    expect(questionResult.success).toBe(false)
    if (!claimResult.success) {
      expect(claimResult.issues.some((issue) => issue.path.join('.') === 'claimQuestionLinks.0.claimId')).toBe(true)
    }
    if (!questionResult.success) {
      expect(
        questionResult.issues.some(
          (issue) => issue.path.join('.') === 'claimQuestionLinks.0.researchQuestionId',
        ),
      ).toBe(true)
    }
  })

  it('enforces strict graph object text and locale-neutral statuses', () => {
    const input = structuredClone(createDemoWorkspace(anchor)) as unknown as {
      researchQuestions: Array<{ text: string; status: string }>
      claims: Array<{ text: string; status: string }>
    }
    const question = input.researchQuestions[0]
    const claim = input.claims[0]
    if (!question || !claim) {
      throw new Error('Expected demo graph records.')
    }
    question.text = '   '
    question.status = '进行中'
    claim.status = 'Active'

    const result = validateWorkspace(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining([
          'researchQuestions.0.text',
          'researchQuestions.0.status',
          'claims.0.status',
        ]),
      )
    }
  })

  it('refuses to export an invalid in-memory snapshot', () => {
    const input = structuredClone(createDemoWorkspace(anchor))
    input.workspace.activeProjectId = 'missing-project'

    expect(() => exportWorkspaceJson(input)).toThrow(WorkspaceValidationError)
  })
})
