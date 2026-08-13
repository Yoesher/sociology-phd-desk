import { describe, expect, it } from 'vitest'
import { createEmptyWorkspace } from '../../models/empty-workspace'
import type { LiteratureItem } from '../../models/domain'
import {
  applyZoteroImport,
  buildZoteroImportPreview,
  MAX_ZOTERO_FRAGMENT_CHARACTERS,
  parseZoteroHandoffFragment,
  parseZoteroHandoffJson,
  type ZoteroHandoff,
} from './zotero-handoff'

const handoff = (overrides: Partial<ZoteroHandoff['items'][number]> = {}): ZoteroHandoff => ({
  application: 'sociology-phd-desk-zotero',
  version: 1,
  createdAt: '2026-08-14T00:00:00.000Z',
  items: [{
    itemKey: 'AB12CD34',
    libraryID: 1,
    itemType: 'journalArticle',
    title: 'Synthetic article',
    creators: [{ firstName: 'Ada', lastName: 'Scholar', creatorType: 'author' }],
    date: '2025',
    DOI: 'https://doi.org/10.1234/SYNTHETIC',
    URL: 'https://example.test/article',
    dateModified: '2026-08-13T00:00:00.000Z',
    ...overrides,
  }],
})

describe('Zotero Handoff v1', () => {
  it('accepts only strict bibliographic metadata and never accepts private Zotero content', () => {
    expect(parseZoteroHandoffJson(JSON.stringify(handoff())).items[0]?.title).toBe('Synthetic article')
    for (const forbidden of ['notes', 'attachments', 'annotations', 'fullText', 'filePath']) {
      expect(() => parseZoteroHandoffJson(JSON.stringify({
        ...handoff(),
        items: [{ ...handoff().items[0], [forbidden]: 'private' }],
      }))).toThrow(/failed validation/)
    }
  })

  it('enforces fragment and protocol size/shape limits before preview', () => {
    expect(parseZoteroHandoffFragment(JSON.stringify(handoff())).version).toBe(1)
    expect(parseZoteroHandoffFragment(JSON.stringify(handoff({ title: 'Percent % title' }))).items[0]?.title).toBe('Percent % title')
    expect(() => parseZoteroHandoffFragment('x'.repeat(MAX_ZOTERO_FRAGMENT_CHARACTERS + 1))).toThrow(/12 KiB/)
    expect(() => parseZoteroHandoffJson(JSON.stringify({ ...handoff(), version: 2 }))).toThrow()
  })

  it('rejects unsupported item types, invalid DOI values, and duplicate source identities', () => {
    expect(() => parseZoteroHandoffJson(JSON.stringify(handoff({ itemType: 'attachment' as 'book' })))).toThrow(/failed validation/)
    expect(() => parseZoteroHandoffJson(JSON.stringify(handoff({ DOI: 'not-a-doi' })))).toThrow(/Invalid DOI/)
    const duplicate = handoff()
    duplicate.items.push(structuredClone(duplicate.items[0]!))
    expect(() => parseZoteroHandoffJson(JSON.stringify(duplicate))).toThrow(/Duplicate Zotero/)
  })

  it('prioritizes exact Zotero identity and treats DOI/title matches only as suggestions', () => {
    const workspace = createEmptyWorkspace({ id: 'workspace-1' })
    workspace.projects.push({ id: 'project-1', title: 'P', shortTitle: 'P', topic: '', method: 'Qualitative', status: 'Idea', startDate: '2026-08-14', notes: '', createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', isDemo: false })
    const literature: LiteratureItem = { id: 'literature-1', title: 'Synthetic article', authors: [], year: 2025, doi: '10.1234/synthetic', projectId: 'project-1', status: 'Reading', priority: 'High', whyRead: 'Local judgment', notes: 'Local note', createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', isDemo: false }
    workspace.literature.push(literature)
    const suggested = buildZoteroImportPreview(workspace, handoff())
    expect(suggested.items[0]?.defaultDecision).toBe('skip')
    expect(suggested.items[0]?.suggestions).toEqual([literature])

    workspace.literatureExternalReferences.push({ id: 'ref-1', literatureItemId: literature.id, provider: 'zotero', externalLibraryId: '1', externalItemKey: 'AB12CD34', importedAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', isDemo: false })
    expect(buildZoteroImportPreview(workspace, handoff()).items[0]?.defaultDecision).toBe('refresh')
  })

  it('refreshes bibliography and provenance without overwriting local research workflow fields', () => {
    const workspace = createEmptyWorkspace({ id: 'workspace-1' })
    workspace.projects.push({ id: 'project-1', title: 'P', shortTitle: 'P', topic: '', method: 'Qualitative', status: 'Idea', startDate: '2026-08-14', notes: '', createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', isDemo: false })
    const firstPreview = buildZoteroImportPreview(workspace, handoff())
    const created = applyZoteroImport(workspace, { preview: firstPreview, choices: [], projectId: 'project-1', status: 'Inbox', priority: 'Medium', whyRead: 'Researcher rationale', now: new Date('2026-08-14T01:00:00.000Z'), idFactory: (() => { let n = 0; return () => String(++n) })() })
    const local = { ...created.literature[0]!, status: 'Cited' as const, priority: 'Critical' as const, whyRead: 'Keep this', notes: 'Keep local note', projectId: 'project-1' }
    created.literature[0] = local
    const changed = handoff({ title: 'Updated bibliography', publicationTitle: 'Updated Journal', volume: '12', issue: '3', pages: '44-61', publisher: 'Synthetic Press', place: 'Test City', ISBN: '978-1-4028-9462-6', ISSN: '1234-5678' })
    const refreshed = applyZoteroImport(created, { preview: buildZoteroImportPreview(created, changed), choices: [], projectId: 'project-1', status: 'Inbox', priority: 'Low', whyRead: 'Ignore', now: new Date('2026-08-14T02:00:00.000Z'), idFactory: () => 'unused' })
    expect(refreshed.literature[0]).toMatchObject({ title: 'Updated bibliography', journal: 'Updated Journal', volume: '12', issue: '3', pages: '44-61', publisher: 'Synthetic Press', place: 'Test City', isbn: '978-1-4028-9462-6', issn: '1234-5678', status: 'Cited', priority: 'Critical', whyRead: 'Keep this', notes: 'Keep local note', projectId: 'project-1' })
    expect(refreshed.literatureExternalReferences).toHaveLength(1)
  })

  it('rejects an explicit create decision for an already linked Zotero identity', () => {
    const workspace = createEmptyWorkspace({ id: 'workspace-1' })
    workspace.projects.push({ id: 'project-1', title: 'P', shortTitle: 'P', topic: '', method: 'Qualitative', status: 'Idea', startDate: '2026-08-14', notes: '', createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', isDemo: false })
    const created = applyZoteroImport(workspace, { preview: buildZoteroImportPreview(workspace, handoff()), choices: [], projectId: 'project-1', status: 'Inbox', priority: 'Medium', whyRead: 'Researcher rationale', idFactory: (() => { let n = 0; return () => String(++n) })() })
    const preview = buildZoteroImportPreview(created, handoff())
    expect(() => applyZoteroImport(created, {
      preview,
      choices: [{ externalLibraryId: '1', itemKey: 'AB12CD34', decision: 'create' }],
      projectId: 'project-1',
      status: 'Inbox',
      priority: 'Medium',
      whyRead: 'Duplicate must not be created',
      idFactory: () => 'duplicate',
    })).toThrow(/can only refresh/)
  })

  it('keeps choices distinct when two Zotero libraries reuse the same item key', () => {
    const workspace = createEmptyWorkspace({ id: 'workspace-1' })
    workspace.projects.push({ id: 'project-1', title: 'P', shortTitle: 'P', topic: '', method: 'Qualitative', status: 'Idea', startDate: '2026-08-14', notes: '', createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', isDemo: false })
    const bundle = handoff()
    bundle.items.push({ ...structuredClone(bundle.items[0]!), libraryID: 2, title: 'Second library article' })
    const imported = applyZoteroImport(workspace, {
      preview: buildZoteroImportPreview(workspace, bundle),
      choices: [
        { externalLibraryId: '1', itemKey: 'AB12CD34', decision: 'skip' },
        { externalLibraryId: '2', itemKey: 'AB12CD34', decision: 'create' },
      ],
      projectId: 'project-1',
      status: 'Inbox',
      priority: 'Medium',
      whyRead: 'Keep the second library copy',
      idFactory: (() => { let n = 0; return () => String(++n) })(),
    })
    expect(imported.literature).toHaveLength(1)
    expect(imported.literature[0]?.title).toBe('Second library article')
    expect(imported.literatureExternalReferences[0]?.externalLibraryId).toBe('2')
  })
})
