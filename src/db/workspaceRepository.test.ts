import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import {
  clearWorkspace,
  getWorkspaceSnapshot,
  initializeWorkspace,
  mergeWorkspace,
  replaceWorkspace,
} from './workspaceRepository'
import { createDemoWorkspace } from '../models/demo'

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
