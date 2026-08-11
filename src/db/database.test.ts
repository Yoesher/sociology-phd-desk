import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { SociologyPhdDeskDatabase } from './database'
import { createDemoWorkspace } from '../models/demo'
import { WorkspaceValidationError } from '../utils/workspace-transfer'

function legacyGraphRecords() {
  const demo = createDemoWorkspace(new Date('2026-04-10T09:30:00.000Z'))
  const project = demo.projects[0]
  const question = demo.researchQuestions[0]
  const firstEvidence = demo.evidence[0]
  if (!project || !question || !firstEvidence) {
    throw new Error('Expected demo graph records.')
  }
  return {
    demo,
    project: { ...project, researchQuestion: `  ${question.text}  ` },
    evidence: [
      { ...firstEvidence, id: 'legacy-evidence-1', claim: `  ${firstEvidence.claim}  ` },
      { ...firstEvidence, id: 'legacy-evidence-2' },
    ],
  }
}

describe('database migrations', () => {
  it('upgrades v1 through revisions and first-class graph tables without losing source text', async () => {
    const databaseName = `sociology-phd-desk-migration-${crypto.randomUUID()}`
    const legacyDatabase = new Dexie(databaseName)
    legacyDatabase.version(1).stores({
      workspaces: '&id, updatedAt',
      projects: '&id, status, method, updatedAt',
      evidence: '&id, projectId, evidenceType, supportLevel',
    })

    const legacyGraph = legacyGraphRecords()
    const legacyWorkspace: Record<string, unknown> = {
      ...legacyGraph.demo.workspace,
    }
    delete legacyWorkspace['revision']
    await legacyDatabase.table('workspaces').put(legacyWorkspace)
    await legacyDatabase.table('projects').put(legacyGraph.project)
    await legacyDatabase.table('evidence').bulkPut(legacyGraph.evidence)
    legacyDatabase.close()

    const upgradedDatabase = new SociologyPhdDeskDatabase(databaseName)
    try {
      const migrated = await upgradedDatabase.workspaces.get(String(legacyWorkspace['id']))
      expect(migrated?.revision).toBe(0)
      expect(upgradedDatabase.verno).toBe(3)
      expect(await upgradedDatabase.researchQuestions.count()).toBe(1)
      expect(await upgradedDatabase.claims.count()).toBe(1)
      expect(await upgradedDatabase.claimQuestionLinks.count()).toBe(0)
      expect((await upgradedDatabase.researchQuestions.toArray())[0]?.text).toBe(
        legacyGraph.project.researchQuestion.trim(),
      )
      expect((await upgradedDatabase.claims.toArray())[0]?.text).toBe(
        legacyGraph.evidence[0]?.claim.trim(),
      )
      expect((await upgradedDatabase.evidence.toArray()).map((item) => item.claim)).toEqual(
        legacyGraph.evidence.map((item) => item.claim),
      )
      expect(
        'researchQuestion' in
          (((await upgradedDatabase.projects.toArray())[0] ?? {}) as unknown as Record<
            string,
            unknown
          >),
      ).toBe(false)
    } finally {
      upgradedDatabase.close()
      await Dexie.delete(databaseName)
    }
  })

  it('upgrades a direct v2 database while preserving its existing revision', async () => {
    const databaseName = `sociology-phd-desk-v2-migration-${crypto.randomUUID()}`
    const legacyDatabase = new Dexie(databaseName)
    legacyDatabase.version(2).stores({
      workspaces: '&id, revision, updatedAt',
      projects: '&id, status, method, updatedAt',
      evidence: '&id, projectId, evidenceType, supportLevel',
    })
    const legacyGraph = legacyGraphRecords()
    await legacyDatabase.table('workspaces').put({ ...legacyGraph.demo.workspace, revision: 7 })
    await legacyDatabase.table('projects').put(legacyGraph.project)
    await legacyDatabase.table('evidence').bulkPut(legacyGraph.evidence)
    legacyDatabase.close()

    const upgradedDatabase = new SociologyPhdDeskDatabase(databaseName)
    try {
      const migrated = await upgradedDatabase.workspaces.get(legacyGraph.demo.workspace.id)
      expect(migrated?.revision).toBe(7)
      expect(await upgradedDatabase.researchQuestions.count()).toBe(1)
      expect(await upgradedDatabase.claims.count()).toBe(1)
      expect(await upgradedDatabase.claimQuestionLinks.count()).toBe(0)
    } finally {
      upgradedDatabase.close()
      await Dexie.delete(databaseName)
    }
  })

  it('rolls back a v2 upgrade when a project has malformed legacy question data', async () => {
    const databaseName = `sociology-phd-desk-v2-invalid-${crypto.randomUUID()}`
    const stores = {
      workspaces: '&id, revision, updatedAt',
      projects: '&id, status, method, updatedAt',
      evidence: '&id, projectId, evidenceType, supportLevel',
    }
    const legacyGraph = legacyGraphRecords()
    const malformedQuestion = { unexpected: 'object' }
    const legacyDatabase = new Dexie(databaseName)
    legacyDatabase.version(2).stores(stores)
    await legacyDatabase.table('workspaces').put({ ...legacyGraph.demo.workspace, revision: 7 })
    await legacyDatabase.table('projects').put({
      ...legacyGraph.project,
      researchQuestion: malformedQuestion,
    })
    await legacyDatabase.table('evidence').bulkPut(legacyGraph.evidence)
    legacyDatabase.close()

    const upgradedDatabase = new SociologyPhdDeskDatabase(databaseName)
    try {
      await expect(upgradedDatabase.open()).rejects.toBeInstanceOf(WorkspaceValidationError)
      upgradedDatabase.close()

      const preservedV2 = new Dexie(databaseName)
      preservedV2.version(2).stores(stores)
      try {
        const preservedProject = await preservedV2.table('projects').get(legacyGraph.project.id)
        expect(preservedV2.verno).toBe(2)
        expect(preservedProject?.researchQuestion).toEqual(malformedQuestion)
      } finally {
        preservedV2.close()
      }
    } finally {
      upgradedDatabase.close()
      await Dexie.delete(databaseName)
    }
  })
})
