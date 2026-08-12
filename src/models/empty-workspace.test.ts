import { describe, expect, it } from 'vitest'
import { validateWorkspace } from '../utils/workspace-transfer'
import { createEmptyWorkspace } from './empty-workspace'

describe('createEmptyWorkspace', () => {
  it('creates a valid non-demo personal snapshot without research records', () => {
    const snapshot = createEmptyWorkspace({
      id: 'personal-workspace',
      name: 'My workspace',
      now: new Date('2026-08-12T00:00:00.000Z'),
    })

    expect(validateWorkspace(snapshot).success).toBe(true)
    expect(snapshot.workspace).toMatchObject({
      id: 'personal-workspace',
      name: 'My workspace',
      isDemo: false,
      revision: 0,
    })
    expect(snapshot.workspace.todayGoals).toEqual([])
    expect(snapshot.projects).toEqual([])
    expect(snapshot.theoryMemos).toEqual([])
    expect(snapshot.reviewerComments).toEqual([])
  })
})
