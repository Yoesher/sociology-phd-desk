import { describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import {
  WorkspaceValidationError,
  exportWorkspaceJson,
  importWorkspaceJson,
  validateWorkspace,
} from './workspace-transfer'

const anchor = new Date('2026-04-10T09:30:00.000Z')

describe('workspace JSON transfer', () => {
  it('round-trips every workspace collection', () => {
    const demo = createDemoWorkspace(anchor)
    const json = exportWorkspaceJson(demo)
    const imported = importWorkspaceJson(json)

    expect(imported.workspace).toEqual(demo.workspace)
    expect(imported.projects).toEqual(demo.projects)
    expect(imported.evidence).toEqual(demo.evidence)
    expect(imported.reviewerComments).toEqual(demo.reviewerComments)
    expect(new Date(imported.exportedAt).toString()).not.toBe('Invalid Date')
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

  it('refuses to export an invalid in-memory snapshot', () => {
    const input = structuredClone(createDemoWorkspace(anchor))
    input.workspace.activeProjectId = 'missing-project'

    expect(() => exportWorkspaceJson(input)).toThrow(WorkspaceValidationError)
  })
})
