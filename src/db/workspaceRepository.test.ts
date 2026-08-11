import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import {
  clearWorkspace,
  getWorkspaceSnapshot,
  initializeWorkspace,
  mergeWorkspace,
  replaceWorkspace,
  WorkspaceConflictError,
} from './workspaceRepository'
import { createDemoWorkspace } from '../models/demo'
import { validateWorkspace, WorkspaceValidationError } from '../utils/workspace-transfer'

const firstAnchor = new Date('2026-04-10T09:30:00.000Z')
const laterTimestamp = '2026-04-11T09:30:00.000Z'

describe('workspace repository', () => {
  beforeEach(async () => {
    await clearWorkspace()
  })

  it('seeds only an empty database and preserves subsequent user edits', async () => {
    const first = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const project = first.projects[0]
    if (!project) {
      throw new Error('Expected a demo project.')
    }

    await db.projects.update(project.id, {
      title: 'Locally edited title',
      updatedAt: laterTimestamp,
    })
    const second = await initializeWorkspace(createDemoWorkspace(new Date(laterTimestamp)))

    expect(second.projects.find((item) => item.id === project.id)?.title).toBe('Locally edited title')
    expect(second.workspace.id).toBe(first.workspace.id)
  })

  it('atomically replaces all persisted workspace collections', async () => {
    await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const replacement = createDemoWorkspace(new Date(laterTimestamp))
    replacement.workspace.id = 'replacement-workspace'
    replacement.workspace.name = 'Replacement workspace'
    replacement.tasks = replacement.tasks.slice(0, 1)
    replacement.evidence = []

    await replaceWorkspace(replacement)
    const persisted = await getWorkspaceSnapshot()

    expect(persisted?.workspace.id).toBe('replacement-workspace')
    expect(persisted?.tasks).toHaveLength(1)
    expect(persisted?.evidence).toEqual([])
  })

  it('rejects a stale full-snapshot write without losing the winning write', async () => {
    const base = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const winningWrite = structuredClone(base)
    winningWrite.workspace.name = 'Concurrent winner'
    winningWrite.workspace.updatedAt = laterTimestamp

    await replaceWorkspace(winningWrite, base.workspace.revision)
    const afterWinner = await getWorkspaceSnapshot()
    expect(afterWinner?.workspace.revision).toBe(1)

    const staleWrite = structuredClone(base)
    staleWrite.workspace.name = 'Stale overwrite'
    staleWrite.tasks = []

    await expect(replaceWorkspace(staleWrite, base.workspace.revision)).rejects.toBeInstanceOf(
      WorkspaceConflictError,
    )

    const persisted = await getWorkspaceSnapshot()
    expect(persisted?.workspace.name).toBe('Concurrent winner')
    expect(persisted?.workspace.revision).toBe(1)
    expect(persisted?.tasks).toEqual(afterWinner?.tasks)
  })

  it('rejects invalid replacement data before clearing any local table', async () => {
    const current = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const invalid = structuredClone(current)
    const task = invalid.tasks[0]
    if (!task) {
      throw new Error('Expected a demo task.')
    }
    task.projectId = 'missing-project'

    await expect(replaceWorkspace(invalid)).rejects.toBeInstanceOf(WorkspaceValidationError)

    const persisted = await getWorkspaceSnapshot()
    expect(persisted?.workspace.revision).toBe(current.workspace.revision)
    expect(persisted?.projects).toEqual(current.projects)
    expect(persisted?.tasks).toEqual(current.tasks)
  })

  it('atomically protects a linked graph parent from full-snapshot deletion', async () => {
    const current = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const invalid = structuredClone(current)
    const linkedClaimId = invalid.claimQuestionLinks[0]?.claimId
    if (!linkedClaimId) {
      throw new Error('Expected a linked demo claim.')
    }
    invalid.claims = invalid.claims.filter((claim) => claim.id !== linkedClaimId)

    await expect(replaceWorkspace(invalid, current.workspace.revision)).rejects.toBeInstanceOf(
      WorkspaceValidationError,
    )

    const persisted = await getWorkspaceSnapshot()
    expect(persisted?.workspace.revision).toBe(current.workspace.revision)
    expect(persisted?.claims).toEqual(current.claims)
    expect(persisted?.claimQuestionLinks).toEqual(current.claimQuestionLinks)
  })

  it('merges new IDs while retaining colliding local records', async () => {
    const current = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const originalProject = current.projects[0]
    if (!originalProject) {
      throw new Error('Expected a demo project.')
    }

    await db.projects.update(originalProject.id, {
      title: 'Local title must win',
      updatedAt: laterTimestamp,
    })
    const incoming = createDemoWorkspace(new Date(laterTimestamp))
    incoming.projects[0] = { ...originalProject, title: 'Imported collision' }
    incoming.projects.push({
      ...originalProject,
      id: 'new-imported-project',
      title: 'New imported project',
      shortTitle: 'New import',
    })

    const result = await mergeWorkspace(incoming)
    const persisted = await getWorkspaceSnapshot()

    expect(result.added.projects).toBe(1)
    expect(result.skipped.projects).toBe(1)
    expect(result.preservedWorkspace).toBe(true)
    expect(persisted?.projects.find((item) => item.id === originalProject.id)?.title).toBe(
      'Local title must win',
    )
    expect(persisted?.projects.some((item) => item.id === 'new-imported-project')).toBe(true)
    expect(persisted?.workspace.revision).toBe(current.workspace.revision + 1)
  })

  it('atomically rejects a colliding claim ID with different semantic text', async () => {
    const current = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const incoming = structuredClone(current)
    const claim = incoming.claims[0]
    if (!claim) {
      throw new Error('Expected a demo claim.')
    }
    claim.text = 'A semantically different incoming claim with the same ID.'
    incoming.researchQuestions.push({
      ...incoming.researchQuestions[0]!,
      id: 'incoming-question-that-must-not-commit',
      text: 'A new incoming question that must be rolled back.',
    })
    expect(validateWorkspace(incoming).success).toBe(true)

    await expect(mergeWorkspace(incoming)).rejects.toBeInstanceOf(WorkspaceValidationError)

    const persisted = await getWorkspaceSnapshot()
    expect(persisted?.claims).toEqual(current.claims)
    expect(
      persisted?.researchQuestions.some(
        (question) => question.id === 'incoming-question-that-must-not-commit',
      ),
    ).toBe(false)
    expect(persisted?.workspace.revision).toBe(current.workspace.revision)
  })

  it('atomically rejects a colliding research-question ID with different semantic text', async () => {
    const current = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const incoming = structuredClone(current)
    const question = incoming.researchQuestions[0]
    if (!question) {
      throw new Error('Expected a demo research question.')
    }
    question.text = 'A different incoming research question with the same ID.'
    expect(validateWorkspace(incoming).success).toBe(true)

    await expect(mergeWorkspace(incoming)).rejects.toBeInstanceOf(WorkspaceValidationError)

    const persisted = await getWorkspaceSnapshot()
    expect(persisted?.researchQuestions).toEqual(current.researchQuestions)
    expect(persisted?.claimQuestionLinks).toEqual(current.claimQuestionLinks)
    expect(persisted?.workspace.revision).toBe(current.workspace.revision)
  })

  it('rejects new graph children under a semantically different colliding project ID', async () => {
    const current = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const incoming = structuredClone(current)
    const project = incoming.projects[0]
    const question = incoming.researchQuestions[0]
    if (!project || !question) {
      throw new Error('Expected demo project graph records.')
    }
    project.title = 'A different imported project reusing the local ID'
    incoming.researchQuestions.push({
      ...question,
      id: 'misdirected-incoming-question',
      text: 'This must not attach to the local project after its parent collision is skipped.',
    })
    expect(validateWorkspace(incoming).success).toBe(true)

    await expect(mergeWorkspace(incoming)).rejects.toBeInstanceOf(WorkspaceValidationError)

    const persisted = await getWorkspaceSnapshot()
    expect(persisted?.projects).toEqual(current.projects)
    expect(
      persisted?.researchQuestions.some(
        (item) => item.id === 'misdirected-incoming-question',
      ),
    ).toBe(false)
    expect(persisted?.workspace.revision).toBe(current.workspace.revision)
  })

  it('atomically rejects a merge whose parent-ID collision breaks project ownership', async () => {
    const current = await initializeWorkspace(createDemoWorkspace(firstAnchor))
    const incoming = createDemoWorkspace(new Date(laterTimestamp))
    const sourceProject = incoming.projects[0]
    const collidingSite = incoming.fieldSites[0]
    const sourceInterview = incoming.interviews[0]
    if (!sourceProject || !collidingSite || !sourceInterview) {
      throw new Error('Expected demo project and fieldwork records.')
    }

    const incomingProjectId = 'incoming-project-b'
    incoming.workspace.activeProjectId = incomingProjectId
    incoming.projects = [
      {
        ...sourceProject,
        id: incomingProjectId,
        title: 'Incoming project B',
        shortTitle: 'Project B',
      },
    ]
    incoming.researchQuestions = []
    incoming.claims = []
    incoming.claimQuestionLinks = []
    incoming.tasks = []
    incoming.literature = []
    incoming.fieldSites = [{ ...collidingSite, projectId: incomingProjectId }]
    incoming.interviews = [
      {
        ...sourceInterview,
        id: 'incoming-interview-b',
        projectId: incomingProjectId,
        fieldSiteId: collidingSite.id,
      },
    ]
    incoming.fieldVisits = []
    incoming.datasets = []
    incoming.analysisRuns = []
    incoming.evidence = []
    incoming.researchLogs = []
    incoming.manuscripts = []
    incoming.submissions = []
    incoming.reviewerComments = []

    expect(validateWorkspace(incoming).success).toBe(true)
    await expect(mergeWorkspace(incoming)).rejects.toBeInstanceOf(WorkspaceValidationError)

    const persisted = await getWorkspaceSnapshot()
    expect(persisted?.workspace.revision).toBe(current.workspace.revision)
    expect(persisted?.projects).toEqual(current.projects)
    expect(persisted?.fieldSites).toEqual(current.fieldSites)
    expect(persisted?.interviews).toEqual(current.interviews)
  })

  it('supports project CRUD through the typed Dexie table', async () => {
    const demo = createDemoWorkspace(firstAnchor)
    const project = demo.projects[0]
    if (!project) {
      throw new Error('Expected a demo project.')
    }
    const addedProject = {
      ...project,
      id: 'project-crud-test',
      title: 'CRUD project',
      shortTitle: 'CRUD',
      isDemo: false,
    }

    await db.projects.add(addedProject)
    await db.projects.update(addedProject.id, { status: 'Writing', updatedAt: laterTimestamp })
    expect((await db.projects.get(addedProject.id))?.status).toBe('Writing')

    await db.projects.delete(addedProject.id)
    expect(await db.projects.get(addedProject.id)).toBeUndefined()
  })

  it('supports evidence and anonymous fieldwork CRUD', async () => {
    const demo = createDemoWorkspace(firstAnchor)
    await replaceWorkspace(demo)
    const evidence = demo.evidence[0]
    const interview = demo.interviews[0]
    if (!evidence || !interview) {
      throw new Error('Expected demo evidence and interview records.')
    }

    await db.evidence.update(evidence.id, {
      supportLevel: 'Weak',
      updatedAt: laterTimestamp,
    })
    await db.interviews.update(interview.id, {
      memoStatus: 'In Progress',
      updatedAt: laterTimestamp,
    })

    expect((await db.evidence.get(evidence.id))?.supportLevel).toBe('Weak')
    expect((await db.interviews.get(interview.id))?.participantAlias).toBe('DEMO-PARTICIPANT-A')
    expect((await db.interviews.get(interview.id))?.memoStatus).toBe('In Progress')

    await db.evidence.delete(evidence.id)
    await db.interviews.delete(interview.id)
    expect(await db.evidence.get(evidence.id)).toBeUndefined()
    expect(await db.interviews.get(interview.id)).toBeUndefined()
  })

  it('clears every collection including workspace metadata', async () => {
    await initializeWorkspace(createDemoWorkspace(firstAnchor))

    await clearWorkspace()

    expect(await getWorkspaceSnapshot()).toBeNull()
    expect(await Promise.all(db.tables.map((table) => table.count()))).toEqual(
      expect.arrayContaining(new Array(db.tables.length).fill(0)),
    )
  })
})
