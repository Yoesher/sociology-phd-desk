import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { SociologyPhdDeskDatabase } from './database'
import { createDemoWorkspace } from '../models/demo'
import { WorkspaceValidationError } from '../utils/workspace-transfer'
import { MAX_SERIALIZED_WORKSPACE_BYTES, workspaceSerializedBytes } from '../utils/workspace-capacity'
import { StandardWorkspaceRepository, WORKSPACE_COLLECTIONS, workspaceSnapshotsEqual } from './workspaceRepository'

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
  it.each([{ version: 5, largeLegacy: false }, { version: 6, largeLegacy: false }, { version: 6, largeLegacy: true }])('opens published v$version (large=$largeLegacy) as v7 and retains research records, PDFs and Zotero provenance', async ({ version, largeLegacy }) => {
    const databaseName = `sociology-phd-desk-v${version}-migration-${crypto.randomUUID()}`
    const legacyDatabase = new Dexie(databaseName)
    legacyDatabase.version(version).stores({
      workspaces: '&id, revision, updatedAt',
      projects: '&id, status, method, updatedAt',
      researchQuestions: '&id, projectId, status, updatedAt',
      claims: '&id, projectId, status, updatedAt',
      claimQuestionLinks: '&id, projectId, claimId, researchQuestionId, updatedAt',
      theoryMemos: '&id, projectId, memoType, updatedAt',
      tasks: '&id, projectId, status, category, dueDate, priority',
      literature: '&id, projectId, status, priority, year',
      literatureExternalReferences: '&id, literatureItemId, provider, &[provider+externalLibraryId+externalItemKey], importedAt',
      fieldSites: '&id, projectId, status',
      interviews: '&id, projectId, fieldSiteId, status, interviewDate',
      fieldVisits: '&id, projectId, fieldSiteId, date',
      datasets: '&id, projectId, name',
      analysisRuns: '&id, projectId, datasetId, status, date',
      evidence: '&id, projectId, evidenceType, supportLevel',
      researchLogs: '&id, projectId, date',
      manuscripts: '&id, projectId, status, deadline',
      submissions: '&id, projectId, manuscriptId, status, submissionDate',
      reviewerComments: '&id, submissionId, status, severity',
    })
    const workspace = createDemoWorkspace(new Date('2026-10-03T00:00:00.000Z'))
    workspace.workspace.revision = 7
    if (largeLegacy) {
      workspace.researchLogs = Array.from({ length: 136 }, (_, index) => ({ ...workspace.researchLogs[0]!, id: `synthetic-large-v6-log-${index}`, problem: 'x'.repeat(250_000) }))
      expect(workspaceSerializedBytes(workspace)).toBeGreaterThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    }
    if (version === 6) {
      const bytes = new TextEncoder().encode('%PDF-1.4\nSYNTHETIC historical database PDF\n%%EOF')
      workspace.literature[0]!.localPdf = { fileName: 'synthetic-v6.pdf', size: bytes.length, base64: btoa(String.fromCharCode(...bytes)) }
    }
    workspace.literatureExternalReferences = [{
      id: 'synthetic-v5-zotero-source',
      createdAt: workspace.exportedAt,
      updatedAt: workspace.exportedAt,
      isDemo: true,
      literatureItemId: workspace.literature[0]!.id,
      provider: 'zotero',
      externalLibraryId: 'synthetic-library',
      externalItemKey: 'SYNTH001',
      externalVersion: 3,
      importedAt: workspace.exportedAt,
    }]
    let repository: StandardWorkspaceRepository | undefined
    try {
      await legacyDatabase.table('workspaces').put(workspace.workspace)
      for (const collection of WORKSPACE_COLLECTIONS.filter((name) => name !== 'fieldMaps')) {
        await legacyDatabase.table(collection).bulkPut(workspace[collection])
      }
      expect(legacyDatabase.verno).toBe(version)
      legacyDatabase.close()
      const upgradedDatabase = new SociologyPhdDeskDatabase(databaseName)
      repository = new StandardWorkspaceRepository(upgradedDatabase, workspace.workspace.id)
      const upgraded = await repository.getWorkspaceSnapshot()
      expect(upgradedDatabase.verno).toBe(7)
      expect(upgraded?.version).toBe(7)
      expect(upgraded && workspaceSnapshotsEqual(upgraded, workspace)).toBe(true)
      expect(upgraded?.workspace.revision).toBe(7)
      expect(upgraded?.literatureExternalReferences).toEqual(workspace.literatureExternalReferences)
      expect(upgraded?.literature).toEqual(workspace.literature)
      expect(upgraded?.fieldMaps).toEqual([])
      expect(upgradedDatabase.tables).toHaveLength(20)
      repository.close()
      repository = new StandardWorkspaceRepository(new SociologyPhdDeskDatabase(databaseName), workspace.workspace.id)
      const reopened = await repository.getWorkspaceSnapshot()
      expect(reopened && workspaceSnapshotsEqual(reopened, workspace)).toBe(true)
    } finally {
      legacyDatabase.close()
      repository?.close()
      await Dexie.delete(databaseName)
    }
  })

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
      expect(upgradedDatabase.verno).toBe(7)
      expect(await upgradedDatabase.researchQuestions.count()).toBe(1)
      expect(await upgradedDatabase.claims.count()).toBe(1)
      expect(await upgradedDatabase.claimQuestionLinks.count()).toBe(0)
      expect(await upgradedDatabase.theoryMemos.count()).toBe(0)
      expect(await upgradedDatabase.literatureExternalReferences.count()).toBe(0)
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
      expect(await upgradedDatabase.theoryMemos.count()).toBe(0)
      expect(await upgradedDatabase.literatureExternalReferences.count()).toBe(0)
    } finally {
      upgradedDatabase.close()
      await Dexie.delete(databaseName)
    }
  })

  it('upgrades a direct v3 graph database through v4 to v5 with empty new tables', async () => {
    const databaseName = `sociology-phd-desk-v3-migration-${crypto.randomUUID()}`
    const graph = legacyGraphRecords()
    const legacyDatabase = new Dexie(databaseName)
    legacyDatabase.version(3).stores({
      workspaces: '&id, revision, updatedAt',
      projects: '&id, status, method, updatedAt',
      researchQuestions: '&id, projectId, status, updatedAt',
      claims: '&id, projectId, status, updatedAt',
      claimQuestionLinks: '&id, projectId, claimId, researchQuestionId, updatedAt',
    })
    await legacyDatabase.table('workspaces').put(graph.demo.workspace)
    await legacyDatabase.table('projects').put(graph.demo.projects[0])
    await legacyDatabase.table('researchQuestions').put(graph.demo.researchQuestions[0])
    await legacyDatabase.table('claims').put(graph.demo.claims[0])
    await legacyDatabase.table('claimQuestionLinks').put(graph.demo.claimQuestionLinks[0])
    legacyDatabase.close()

    const upgradedDatabase = new SociologyPhdDeskDatabase(databaseName)
    try {
      await upgradedDatabase.open()
      expect(upgradedDatabase.verno).toBe(7)
      expect(await upgradedDatabase.projects.count()).toBe(1)
      expect(await upgradedDatabase.researchQuestions.count()).toBe(1)
      expect(await upgradedDatabase.claims.count()).toBe(1)
      expect(await upgradedDatabase.claimQuestionLinks.count()).toBe(1)
      expect(await upgradedDatabase.theoryMemos.count()).toBe(0)
      expect(await upgradedDatabase.literatureExternalReferences.count()).toBe(0)
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
