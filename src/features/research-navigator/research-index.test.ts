import { describe, expect, it } from 'vitest'
import { createEmptyWorkspace } from '../../models/empty-workspace'
import type { EntityMetadata, WorkspaceData } from '../../models/domain'
import { researchFieldMessages } from '../../i18n/messages/researchFields'
import {
  RECORD_KINDS, RESEARCH_FIELD_LABELS, buildProjectOverview, buildResearchIndex, getRelatedRecords, searchResearchIndex,
  type RecordKind,
} from './research-index'

function meta(id: string, updatedAt = '2026-10-04T08:00:00.000Z'): EntityMetadata {
  return { id, createdAt: '2026-10-01T08:00:00.000Z', updatedAt, isDemo: true }
}

function fixture(): WorkspaceData {
  const data = createEmptyWorkspace({ id: 'navigator-test', now: new Date('2026-10-04T08:00:00Z') })
  data.projects = ['p1', 'p2'].map((id) => ({ ...meta(id), title: `Project ${id}`, shortTitle: id, topic: 'Family research', method: 'Mixed Methods', status: 'Analysis', startDate: '2026-01-01', notes: 'Project notes' }))
  data.researchQuestions = [{ ...meta('q1'), projectId: 'p1', text: 'Question one', status: 'active', notes: 'Question notes' }]
  data.claims = [{ ...meta('c1'), projectId: 'p1', text: 'Claim one', status: 'active', notes: 'Claim notes' }]
  data.claimQuestionLinks = [{ ...meta('link1'), projectId: 'p1', claimId: 'c1', researchQuestionId: 'q1' }]
  data.theoryMemos = [{ ...meta('th1'), projectId: 'p1', title: 'Theory one', memoType: 'mechanism', content: 'Mechanism detail', relatedQuestionIds: ['q1'], relatedClaimIds: ['c1'], relatedLiteratureIds: ['l1'] }]
  data.tasks = [{ ...meta('t1'), projectId: 'p1', title: 'Task one', category: 'Writing', status: 'To Do', dueDate: '2026-10-04', priority: 'High', notes: 'Task detail' }]
  data.literature = [{ ...meta('l1'), projectId: 'p1', title: 'Literature one', authors: ['DEMO Author', 'Synthetic Author'], year: 2026, journal: 'DEMO journal', doi: 'DEMO identifier', status: 'Read', priority: 'Medium', whyRead: 'Why read', notes: 'Literature detail', url: 'https://excluded-url.invalid' }]
  data.literatureExternalReferences = [{ ...meta('external1'), literatureItemId: 'l1', provider: 'zotero', externalLibraryId: 'EXTERNAL_SECRET', externalItemKey: 'REMOTE_KEY', importedAt: '2026-10-01T00:00:00Z' }]
  data.fieldSites = [{ ...meta('s1'), projectId: 'p1', nameOrAlias: 'Site one', status: 'Active', notes: 'Coarse synthetic place' }]
  data.fieldMaps = [{ ...meta('m1'), projectId: 'p1', title: 'Map one', image: { fileName: 'private-map.jpg', mimeType: 'image/jpeg', size: 20, width: 1, height: 1, base64: 'EXCLUDED_IMAGE_BYTES' }, markers: [{ fieldSiteId: 's1', x: 0.2, y: 0.8 }] }]
  data.interviews = [{ ...meta('i1'), projectId: 'p1', fieldSiteId: 's1', participantAlias: 'DEMO alias', interviewDate: '2026-10-03', status: 'Completed', transcriptStatus: 'In Progress', codingStatus: 'Not Started', memoStatus: 'Complete', notes: 'Interview detail' }]
  data.fieldVisits = [{ ...meta('v1'), projectId: 'p1', fieldSiteId: 's1', date: '2026-10-02', purpose: 'Visit one', observations: 'Observation detail', followUp: 'Next contact', memo: 'Field memo' }]
  data.datasets = [{ ...meta('d1'), projectId: 'p1', name: 'Dataset one', wave: 'DEMO wave', source: 'Synthetic source', localPath: 'D:/excluded-dataset', notes: 'Sample notes' }]
  data.analysisRuns = [{ ...meta('a1'), projectId: 'p1', datasetId: 'd1', date: '2026-10-03', software: 'R', scriptPath: 'D:/excluded-script', sample: 'DEMO sample', model: 'Model one', outcome: 'Outcome detail', keyPredictor: 'Predictor detail', status: 'Completed', resultSummary: 'Result detail', outputPath: 'D:/excluded-output' }]
  data.evidence = [{ ...meta('e1'), projectId: 'p1', claim: 'Claim one', evidenceType: 'Interview', source: 'Site one', locator: 'page DEMO', finding: 'Finding detail', supportLevel: 'Unclear', limitations: 'No inference', manuscriptLocation: 'Manuscript one' }]
  data.researchLogs = [{ ...meta('r1'), projectId: 'p1', date: '2026-10-04', whatChanged: 'Log one', decision: 'Decision detail', problem: 'Problem detail', nextStep: 'Next step detail' }]
  data.manuscripts = [{ ...meta('ms1'), projectId: 'p1', title: 'Manuscript one', targetJournal: 'DEMO journal', status: 'Revision', wordCount: 0, nextAction: 'Manuscript next action', deadline: '2026-10-12' }]
  data.submissions = [{ ...meta('sub1'), projectId: 'p1', manuscriptId: 'ms1', journal: 'Submission journal', submissionDate: '2026-09-01', manuscriptVersion: 'DEMO draft', status: 'Revision', editorialStatus: 'Decision pending', notes: 'Submission detail' }]
  data.reviewerComments = [{ ...meta('rev1'), submissionId: 'sub1', reviewer: 'Reviewer DEMO', commentId: 'Review one', comment: 'Comment detail', severity: 'Major', response: 'Response detail', revisionAction: 'Revision detail', status: 'Open' }]
  return data
}

function record(data: WorkspaceData, kind: RecordKind, id: string) {
  const index = buildResearchIndex(data)
  const item = index.find((value) => value.key === `${kind}:${id}`)
  if (!item) throw new Error(`Missing fixture record ${kind}:${id}`)
  return { index, item }
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

describe('buildResearchIndex', () => {
  it('indexes all 17 entity kinds without turning link/provider rows into results', () => {
    const data = fixture()
    const index = buildResearchIndex(data)
    expect([...new Set(index.map((item) => item.kind))]).toEqual([...RECORD_KINDS])
    expect(index).toHaveLength(18)
    expect(index.find((item) => item.key === 'review:rev1')?.projectId).toBe('p1')
    expect(index.every((item) => item.key === `${item.kind}:${item.id}` && /^\/[a-z-]+$/u.test(item.route))).toBe(true)
    expect(index.find((item) => item.kind === 'question')?.route).toBe('/projects')
    expect(index.find((item) => item.kind === 'claim')?.route).toBe('/projects')
    expect(index.find((item) => item.kind === 'theory')?.route).toBe('/theory')
    expect(searchResearchIndex(index, 'EXTERNAL_SECRET')).toEqual([])
  })

  it('has complete Chinese and English labels for every explicitly allowed field', () => {
    const labels = new Set<string>(RESEARCH_FIELD_LABELS)
    expect(RESEARCH_FIELD_LABELS).toHaveLength(labels.size)
    for (const label of RESEARCH_FIELD_LABELS) {
      const key = `navigator.field.${label}` as keyof typeof researchFieldMessages.en
      expect(researchFieldMessages.en[key]?.trim()).toBeTruthy()
      expect(researchFieldMessages['zh-CN'][key]?.trim()).toBeTruthy()
    }
    expect(buildResearchIndex(fixture()).flatMap((item) => item.fields).every((field) => labels.has(field.label))).toBe(true)
  })

  it('never reads attachment payloads, filenames, image data, URLs or local paths', () => {
    const data = fixture()
    const rejectRead = () => { throw new Error('Sensitive field was read') }
    Object.defineProperty(data.literature[0], 'localPdf', { get: rejectRead })
    Object.defineProperty(data.literature[0], 'url', { get: rejectRead })
    Object.defineProperty(data.fieldMaps[0], 'image', { get: rejectRead })
    Object.defineProperty(data.datasets[0], 'localPath', { get: rejectRead })
    Object.defineProperty(data.analysisRuns[0], 'scriptPath', { get: rejectRead })
    Object.defineProperty(data.analysisRuns[0], 'outputPath', { get: rejectRead })
    expect(() => buildResearchIndex(data)).not.toThrow()
    const index = buildResearchIndex(data)
    expect(JSON.stringify(index)).not.toMatch(/base64|fileName|localPdf|localPath|scriptPath|outputPath|EXCLUDED|REMOTE_KEY/u)
  })

  it('keeps original plain research fields, zero counts, evidence locators and user URLs in notes', () => {
    const data = fixture()
    data.literature[0].notes = 'Research note https://user-entered.invalid/context'
    const index = buildResearchIndex(data)
    expect(index.find((item) => item.key === 'manuscript:ms1')?.fields).toContainEqual({ label: 'wordCount', value: '0' })
    expect(index.find((item) => item.key === 'literature:l1')?.fields).toContainEqual({ label: 'notes', value: data.literature[0].notes })
    expect(searchResearchIndex(index, 'manuscript one', { kind: 'evidence' })).toHaveLength(1)
    expect(searchResearchIndex(index, 'user-entered.invalid')).toHaveLength(1)
    expect(searchResearchIndex(index, 'synthetic author')).toHaveLength(1)
  })

  it('does not assign an orphan reviewer comment to an arbitrary project', () => {
    const data = fixture()
    data.reviewerComments[0].submissionId = 'absent'
    expect(buildResearchIndex(data).some((item) => item.kind === 'review')).toBe(false)
  })

  it('creates fresh projections without mutating the complete workspace', () => {
    const data = freeze(fixture())
    const before = JSON.stringify(data)
    const index = buildResearchIndex(data)
    searchResearchIndex(index, 'one')
    getRelatedRecords(data, index, index[0])
    buildProjectOverview(data, '2026-10-04')
    expect(JSON.stringify(data)).toBe(before)
    index[0].fields[0].value = 'Changed only in transient projection'
    expect(data.projects[0].title).toBe('Project p1')
  })
})

describe('searchResearchIndex', () => {
  it('uses NFC/case folding and AND words across allowed fields', () => {
    const data = fixture()
    data.tasks[0].title = '家庭 Cafe\u0301'
    data.tasks[0].notes = 'Field research 中文研究'
    const index = buildResearchIndex(data)
    expect(searchResearchIndex(index, ' CAFÉ\t家庭\n中文研究 ')).toHaveLength(1)
    expect(searchResearchIndex(index, '家庭 absent')).toEqual([])
  })

  it('treats metacharacters as literal text and does not truncate query words', () => {
    const data = fixture()
    data.tasks[0].notes = '[alpha] .* first second third fourth fifth sixth'
    const index = buildResearchIndex(data)
    expect(searchResearchIndex(index, '[alpha] .*')).toHaveLength(1)
    expect(searchResearchIndex(index, 'first second third fourth fifth absent')).toEqual([])
    expect(searchResearchIndex(index, 'x'.repeat(201))).toEqual([])
    data.tasks[0].notes = 'x'.repeat(200)
    expect(searchResearchIndex(buildResearchIndex(data), 'x'.repeat(200))).toHaveLength(1)
  })

  it('honors project/kind scopes without modifying input or persisting a query', () => {
    const data = fixture()
    data.tasks.push({ ...data.tasks[0], ...meta('t2'), projectId: 'p2' })
    const index = buildResearchIndex(data)
    const before = JSON.stringify(index)
    expect(searchResearchIndex(index, 'Task', { projectId: 'p1', kind: 'task' }).map((item) => item.id)).toEqual(['t1'])
    expect(searchResearchIndex(index, 'Task', { kind: 'task' })).toHaveLength(2)
    expect(searchResearchIndex(index, '', { projectId: 'missing' })).toEqual([])
    expect(JSON.stringify(index)).toBe(before)
  })

  it('prioritizes all-title matches, then newest timestamp and deterministic typed key', () => {
    const data = fixture()
    data.tasks = [
      { ...data.tasks[0], ...meta('z', '2026-10-01T00:00:00Z'), title: 'Needle' },
      { ...data.tasks[0], ...meta('a', '2026-10-02T00:00:00Z'), title: 'Needle' },
      { ...data.tasks[0], ...meta('b', '2026-10-02T00:00:00Z'), title: 'Needle' },
      { ...data.tasks[0], ...meta('body', '2026-10-04T00:00:00Z'), title: 'Other', notes: 'Needle' },
    ]
    const index = buildResearchIndex(data)
    expect(searchResearchIndex(index, 'needle').map((item) => item.id)).toEqual(['a', 'b', 'z', 'body'])
    expect(searchResearchIndex(index, '', { kind: 'task' }).map((item) => item.id)).toEqual(['body', 'a', 'b', 'z'])
  })

  it('compares timestamps chronologically when ISO fractional precision differs', () => {
    const data = fixture()
    data.tasks = [
      { ...data.tasks[0], ...meta('earlier', '2026-10-04T08:00:00Z') },
      { ...data.tasks[0], ...meta('later', '2026-10-04T08:00:00.500Z') },
    ]
    expect(searchResearchIndex(buildResearchIndex(data), '', { kind: 'task' }).map((item) => item.id)).toEqual(['later', 'earlier'])
  })
})

describe('getRelatedRecords', () => {
  it.each([
    ['question', 'q1', 'claim', 'c1'], ['theory', 'th1', 'question', 'q1'],
    ['theory', 'th1', 'claim', 'c1'], ['theory', 'th1', 'literature', 'l1'],
    ['site', 's1', 'map', 'm1'], ['site', 's1', 'visit', 'v1'],
    ['site', 's1', 'interview', 'i1'], ['dataset', 'd1', 'analysis', 'a1'],
    ['manuscript', 'ms1', 'submission', 'sub1'], ['submission', 'sub1', 'review', 'rev1'],
  ] as Array<[RecordKind, string, RecordKind, string]>)('returns explicit %s↔%s and %s↔%s edges in both directions', (leftKind, leftId, rightKind, rightId) => {
    const data = fixture()
    const { index, item: left } = record(data, leftKind, leftId)
    const right = index.find((item) => item.key === `${rightKind}:${rightId}`)!
    expect(getRelatedRecords(data, index, left).map((item) => item.key)).toContain(right.key)
    expect(getRelatedRecords(data, index, right).map((item) => item.key)).toContain(left.key)
  })

  it('shows same-project membership without calling every project peer a direct relation', () => {
    const data = fixture()
    const { index, item } = record(data, 'task', 't1')
    expect(getRelatedRecords(data, index, item).map((value) => value.key)).toEqual(['project:p1'])
    expect(getRelatedRecords(data, index, index.find((value) => value.key === 'project:p1')!)).toHaveLength(16)
    expect(getRelatedRecords(data, index, index.find((value) => value.key === 'project:p2')!)).toEqual([])
  })

  it('does not guess evidence relationships from identical claim/source/manuscript text', () => {
    const data = fixture()
    const { index, item } = record(data, 'evidence', 'e1')
    expect(getRelatedRecords(data, index, item).map((value) => value.key)).toEqual(['project:p1'])
    expect(getRelatedRecords(data, index, index.find((value) => value.key === 'claim:c1')!).some((value) => value.kind === 'evidence')).toBe(false)
  })

  it('ignores cross-project, dangling and duplicated links and stale result handles', () => {
    const data = fixture()
    data.claims[0].projectId = 'p2'
    data.theoryMemos[0].relatedQuestionIds.push('missing', 'q1')
    data.fieldMaps[0].markers.push({ fieldSiteId: 's1', x: 0.8, y: 0.2 }, { fieldSiteId: 'absent', x: 0, y: 0 })
    const { index, item } = record(data, 'question', 'q1')
    const related = getRelatedRecords(data, index, item)
    expect(related.map((value) => value.key)).toEqual(['project:p1', 'theory:th1'])
    expect(getRelatedRecords(data, index, { ...item, projectId: 'p2' })).toEqual([])
    expect(getRelatedRecords(data, index, { ...item, key: 'question:deleted' })).toEqual([])
    const site = index.find((value) => value.key === 'site:s1')!
    expect(getRelatedRecords(data, index, site).filter((value) => value.kind === 'map')).toHaveLength(1)
  })

  it('uses typed keys when separate collections reuse an ID and never reads image bytes', () => {
    const data = fixture()
    data.tasks[0].id = 'q1'
    Object.defineProperty(data.fieldMaps[0], 'image', { get: () => { throw new Error('Image read') } })
    const { index, item } = record(data, 'question', 'q1')
    expect(index.some((value) => value.key === 'task:q1')).toBe(true)
    expect(getRelatedRecords(data, index, item).some((value) => value.key === 'task:q1')).toBe(false)
  })
})

describe('buildProjectOverview', () => {
  it('counts actual project records, active questions and open reviews without mixing projects', () => {
    const data = fixture()
    data.researchQuestions.push(
      { ...data.researchQuestions[0], ...meta('q2'), status: 'draft' },
      { ...data.researchQuestions[0], ...meta('q3'), status: 'addressed' },
      { ...data.researchQuestions[0], ...meta('q4'), status: 'retired' },
    )
    data.reviewerComments.push(
      { ...data.reviewerComments[0], ...meta('rev2'), status: 'Addressing' },
      { ...data.reviewerComments[0], ...meta('rev3'), status: 'Resolved' },
      { ...data.reviewerComments[0], ...meta('rev4'), status: 'Rejected with Rationale' },
    )
    const [first, second] = buildProjectOverview(data, '2026-10-04')
    expect(first).toMatchObject({ projectId: 'p1', totalTasks: 1, doneTasks: 0, overdueTasks: 0, upcomingTasks: 1, openQuestions: 2, unlinkedQuestions: 1, claims: 1, theoryMemos: 1, literature: 1, fieldSites: 1, mappedSites: 1, interviews: 1, datasets: 1, analysisRuns: 1, evidence: 1, manuscripts: 1, openReviews: 2 })
    expect(second).toEqual({ projectId: 'p2', title: 'Project p2', totalTasks: 0, doneTasks: 0, overdueTasks: 0, upcomingTasks: 0, openQuestions: 0, unlinkedQuestions: 0, claims: 0, theoryMemos: 0, literature: 0, fieldSites: 0, mappedSites: 0, interviews: 0, datasets: 0, analysisRuns: 0, evidence: 0, manuscripts: 0, openReviews: 0 })
  })

  it('uses today through six days ahead and excludes Done/Deferred/missing/invalid dates', () => {
    const data = fixture()
    data.tasks = [
      ['before', '2026-10-03', 'To Do'], ['today', '2026-10-04', 'In Progress'],
      ['last', '2026-10-10', 'To Do'], ['outside', '2026-10-11', 'To Do'],
      ['done', '2026-10-01', 'Done'], ['deferred', '2026-10-06', 'Deferred'],
      ['missing', undefined, 'To Do'], ['invalid', '2026-02-30', 'To Do'],
    ].map(([id, dueDate, status]) => ({ ...data.tasks[0], ...meta(id!), dueDate, status: status as WorkspaceData['tasks'][number]['status'] }))
    expect(buildProjectOverview(data, '2026-10-04')[0]).toMatchObject({ totalTasks: 8, doneTasks: 1, overdueTasks: 1, upcomingTasks: 2 })
    expect(buildProjectOverview(data, 'invalid')[0]).toMatchObject({ overdueTasks: 0, upcomingTasks: 0 })
  })

  it('handles month/year boundaries and leap days as calendar days rather than elapsed hours', () => {
    const data = fixture()
    data.tasks = [
      { ...data.tasks[0], ...meta('leap'), dueDate: '2028-02-29' },
      { ...data.tasks[0], ...meta('march'), dueDate: '2028-03-05' },
      { ...data.tasks[0], ...meta('late'), dueDate: '2028-03-06' },
    ]
    expect(buildProjectOverview(data, '2028-02-28')[0].upcomingTasks).toBe(2)
    data.tasks[0].dueDate = '2027-01-05'
    expect(buildProjectOverview(data, '2026-12-30')[0].upcomingTasks).toBe(1)
  })

  it('counts unique valid map sites and disregards invalid cross-project question links', () => {
    const data = fixture()
    data.fieldSites.push({ ...data.fieldSites[0], ...meta('s2'), projectId: 'p2' })
    data.fieldMaps[0].markers.push({ fieldSiteId: 's1', x: 0.3, y: 0.4 }, { fieldSiteId: 's2', x: 0, y: 0 }, { fieldSiteId: 'missing', x: 0, y: 0 })
    data.fieldMaps.push({ ...data.fieldMaps[0], ...meta('m2') })
    data.claims[0].projectId = 'p2'
    Object.defineProperty(data.fieldMaps[0], 'image', { get: () => { throw new Error('Image read') } })
    const [first, second] = buildProjectOverview(data, '2026-10-04')
    expect(first).toMatchObject({ fieldSites: 1, mappedSites: 1, openQuestions: 1, unlinkedQuestions: 1 })
    expect(second).toMatchObject({ fieldSites: 1, mappedSites: 0, claims: 1 })
  })
})
