import type { EntityMetadata, WorkspaceData } from '../../models/domain'

export const RECORD_KINDS = [
  'project', 'question', 'claim', 'theory', 'task', 'literature', 'site', 'map',
  'interview', 'visit', 'dataset', 'analysis', 'evidence', 'log', 'manuscript',
  'submission', 'review',
] as const

export type RecordKind = (typeof RECORD_KINDS)[number]

export const RESEARCH_FIELD_LABELS = [
  'title', 'shortTitle', 'topic', 'method', 'status', 'startDate', 'targetDate', 'notes',
  'text', 'memoType', 'content', 'category', 'dueDate', 'priority', 'authors', 'itemType',
  'year', 'journal', 'volume', 'issue', 'pages', 'publisher', 'place', 'doi', 'isbn', 'issn',
  'whyRead', 'nameOrAlias', 'participantAlias', 'interviewDate', 'transcriptStatus',
  'codingStatus', 'memoStatus', 'date', 'purpose', 'observations', 'followUp', 'memo',
  'name', 'wave', 'source', 'software', 'sample', 'model', 'outcome', 'keyPredictor',
  'resultSummary', 'claim', 'evidenceType', 'locator', 'finding', 'supportLevel',
  'limitations', 'manuscriptLocation', 'whatChanged', 'decision', 'problem', 'nextStep',
  'targetJournal', 'wordCount', 'nextAction', 'deadline', 'submissionDate',
  'manuscriptVersion', 'editorialStatus', 'decisionDate', 'reviewer', 'commentId',
  'comment', 'severity', 'response', 'revisionAction',
] as const

export interface ResearchRecord {
  key: string
  id: string
  kind: RecordKind
  projectId: string
  title: string
  route: string
  updatedAt: string
  fields: Array<{ label: string; value: string }>
  searchText: string
}

export interface ProjectOverview {
  projectId: string
  title: string
  totalTasks: number
  doneTasks: number
  overdueTasks: number
  upcomingTasks: number
  openQuestions: number
  unlinkedQuestions: number
  claims: number
  theoryMemos: number
  literature: number
  fieldSites: number
  mappedSites: number
  interviews: number
  datasets: number
  analysisRuns: number
  evidence: number
  manuscripts: number
  openReviews: number
}

const ROUTES: Record<RecordKind, string> = {
  project: '/projects', question: '/projects', claim: '/projects', theory: '/theory',
  task: '/today', literature: '/literature', site: '/fieldwork', map: '/fieldwork',
  interview: '/fieldwork', visit: '/fieldwork', dataset: '/quantitative',
  analysis: '/quantitative', evidence: '/evidence', log: '/research-log',
  manuscript: '/publishing', submission: '/publishing', review: '/publishing',
}

type FieldValue = string | number | undefined
type FieldPair = [label: (typeof RESEARCH_FIELD_LABELS)[number], value: FieldValue]

function normalize(value: string): string {
  return value.normalize('NFC').toLowerCase()
}

function fields(...pairs: FieldPair[]): ResearchRecord['fields'] {
  return pairs.flatMap(([label, value]) => {
    if (typeof value === 'string' && value.trim()) return [{ label, value }]
    if (typeof value === 'number' && Number.isFinite(value)) return [{ label, value: String(value) }]
    return []
  })
}

/** A transient, text-only projection. Never enumerate or serialize domain records. */
export function buildResearchIndex(data: WorkspaceData): ResearchRecord[] {
  const index: ResearchRecord[] = []
  const append = (kind: RecordKind, item: EntityMetadata, projectId: string, title: string, values: ResearchRecord['fields']) => {
    index.push({
      key: `${kind}:${item.id}`, id: item.id, kind, projectId, title,
      route: ROUTES[kind], updatedAt: item.updatedAt, fields: values,
      searchText: normalize([title, ...values.map((field) => field.value)].join('\n')),
    })
  }
  for (const item of data.projects) append('project', item, item.id, item.title, fields(
    ['title', item.title], ['shortTitle', item.shortTitle], ['topic', item.topic],
    ['method', item.method], ['status', item.status], ['startDate', item.startDate],
    ['targetDate', item.targetDate], ['notes', item.notes],
  ))
  for (const item of data.researchQuestions) append('question', item, item.projectId, item.text, fields(
    ['text', item.text], ['status', item.status], ['notes', item.notes],
  ))
  for (const item of data.claims) append('claim', item, item.projectId, item.text, fields(
    ['text', item.text], ['status', item.status], ['notes', item.notes],
  ))
  for (const item of data.theoryMemos) append('theory', item, item.projectId, item.title, fields(
    ['title', item.title], ['memoType', item.memoType], ['content', item.content],
  ))
  for (const item of data.tasks) append('task', item, item.projectId, item.title, fields(
    ['title', item.title], ['category', item.category], ['status', item.status],
    ['dueDate', item.dueDate], ['priority', item.priority], ['notes', item.notes],
  ))
  for (const item of data.literature) append('literature', item, item.projectId, item.title, fields(
    ['title', item.title], ['authors', item.authors.join('; ')], ['itemType', item.itemType],
    ['year', item.year], ['journal', item.journal], ['volume', item.volume], ['issue', item.issue],
    ['pages', item.pages], ['publisher', item.publisher], ['place', item.place], ['doi', item.doi],
    ['isbn', item.isbn], ['issn', item.issn], ['status', item.status], ['priority', item.priority],
    ['whyRead', item.whyRead], ['notes', item.notes],
  ))
  for (const item of data.fieldSites) append('site', item, item.projectId, item.nameOrAlias, fields(
    ['nameOrAlias', item.nameOrAlias], ['status', item.status], ['notes', item.notes],
  ))
  for (const item of data.fieldMaps) append('map', item, item.projectId, item.title, fields(['title', item.title]))
  for (const item of data.interviews) append('interview', item, item.projectId, item.participantAlias, fields(
    ['participantAlias', item.participantAlias], ['interviewDate', item.interviewDate], ['status', item.status],
    ['transcriptStatus', item.transcriptStatus], ['codingStatus', item.codingStatus],
    ['memoStatus', item.memoStatus], ['notes', item.notes],
  ))
  for (const item of data.fieldVisits) append('visit', item, item.projectId, item.purpose || item.date, fields(
    ['date', item.date], ['purpose', item.purpose], ['observations', item.observations],
    ['followUp', item.followUp], ['memo', item.memo],
  ))
  for (const item of data.datasets) append('dataset', item, item.projectId, item.name, fields(
    ['name', item.name], ['wave', item.wave], ['source', item.source], ['notes', item.notes],
  ))
  for (const item of data.analysisRuns) append('analysis', item, item.projectId, item.model || item.date, fields(
    ['date', item.date], ['software', item.software], ['sample', item.sample], ['model', item.model],
    ['outcome', item.outcome], ['keyPredictor', item.keyPredictor], ['status', item.status],
    ['resultSummary', item.resultSummary],
  ))
  for (const item of data.evidence) append('evidence', item, item.projectId, item.claim, fields(
    ['claim', item.claim], ['evidenceType', item.evidenceType], ['source', item.source], ['locator', item.locator],
    ['finding', item.finding], ['supportLevel', item.supportLevel], ['limitations', item.limitations],
    ['manuscriptLocation', item.manuscriptLocation],
  ))
  for (const item of data.researchLogs) append('log', item, item.projectId, item.whatChanged, fields(
    ['date', item.date], ['whatChanged', item.whatChanged], ['decision', item.decision],
    ['problem', item.problem], ['nextStep', item.nextStep],
  ))
  for (const item of data.manuscripts) append('manuscript', item, item.projectId, item.title, fields(
    ['title', item.title], ['targetJournal', item.targetJournal], ['status', item.status],
    ['wordCount', item.wordCount], ['nextAction', item.nextAction], ['deadline', item.deadline],
  ))
  for (const item of data.submissions) append('submission', item, item.projectId, item.journal, fields(
    ['journal', item.journal], ['submissionDate', item.submissionDate], ['manuscriptVersion', item.manuscriptVersion],
    ['status', item.status], ['editorialStatus', item.editorialStatus], ['decisionDate', item.decisionDate],
    ['decision', item.decision], ['notes', item.notes],
  ))
  const submissions = new Map(data.submissions.map((item) => [item.id, item]))
  for (const item of data.reviewerComments) {
    const submission = submissions.get(item.submissionId)
    if (!submission) continue
    append('review', item, submission.projectId, item.commentId || item.comment, fields(
      ['reviewer', item.reviewer], ['commentId', item.commentId], ['comment', item.comment], ['severity', item.severity],
      ['response', item.response], ['revisionAction', item.revisionAction], ['status', item.status],
    ))
  }
  return index
}

function compareRecent(left: ResearchRecord, right: ResearchRecord): number {
  const leftTime = Date.parse(left.updatedAt)
  const rightTime = Date.parse(right.updatedAt)
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime
  return left.key < right.key ? -1 : left.key > right.key ? 1 : 0
}

/** Literal AND terms, without regex, query history, URL state or persisted indexes. */
export function searchResearchIndex(
  index: ResearchRecord[], query: string, options: { projectId?: string; kind?: RecordKind } = {},
): ResearchRecord[] {
  if (query.length > 200) return []
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean)
  const titleMatches = (record: ResearchRecord) => terms.length > 0 && terms.every((term) => normalize(record.title).includes(term))
  return index.filter((record) =>
    (!options.projectId || record.projectId === options.projectId) &&
    (!options.kind || record.kind === options.kind) &&
    terms.every((term) => record.searchText.includes(term)),
  ).sort((left, right) => Number(titleMatches(right)) - Number(titleMatches(left)) || compareRecent(left, right))
}

/** Only explicit, existing same-project IDs become edges; free prose never does. */
export function getRelatedRecords(data: WorkspaceData, index: ResearchRecord[], record: ResearchRecord): ResearchRecord[] {
  const byKey = new Map(index.map((item) => [item.key, item]))
  const current = byKey.get(record.key)
  if (!current || current.id !== record.id || current.kind !== record.kind || current.projectId !== record.projectId) return []
  const keys = new Set<string>()
  const connect = (leftKind: RecordKind, leftId: string, rightKind: RecordKind, rightId: string, projectId: string) => {
    const left = byKey.get(`${leftKind}:${leftId}`)
    const right = byKey.get(`${rightKind}:${rightId}`)
    if (!left || !right || left.projectId !== projectId || right.projectId !== projectId) return
    if (left.key === current.key) keys.add(right.key)
    if (right.key === current.key) keys.add(left.key)
  }
  if (current.kind === 'project') {
    for (const item of index) if (item.projectId === current.id && item.key !== current.key) keys.add(item.key)
  } else {
    const project = byKey.get(`project:${current.projectId}`)
    if (project?.projectId === current.projectId) keys.add(project.key)
  }
  for (const item of data.claimQuestionLinks) connect('claim', item.claimId, 'question', item.researchQuestionId, item.projectId)
  for (const item of data.theoryMemos) {
    for (const id of item.relatedQuestionIds) connect('theory', item.id, 'question', id, item.projectId)
    for (const id of item.relatedClaimIds) connect('theory', item.id, 'claim', id, item.projectId)
    for (const id of item.relatedLiteratureIds) connect('theory', item.id, 'literature', id, item.projectId)
  }
  for (const item of data.fieldMaps) for (const marker of item.markers) connect('map', item.id, 'site', marker.fieldSiteId, item.projectId)
  for (const item of data.fieldVisits) connect('visit', item.id, 'site', item.fieldSiteId, item.projectId)
  for (const item of data.interviews) if (item.fieldSiteId) connect('interview', item.id, 'site', item.fieldSiteId, item.projectId)
  for (const item of data.analysisRuns) connect('analysis', item.id, 'dataset', item.datasetId, item.projectId)
  for (const item of data.submissions) connect('submission', item.id, 'manuscript', item.manuscriptId, item.projectId)
  const submissions = new Map(data.submissions.map((item) => [item.id, item]))
  for (const item of data.reviewerComments) {
    const submission = submissions.get(item.submissionId)
    if (submission) connect('review', item.id, 'submission', item.submissionId, submission.projectId)
  }
  return [...keys].filter((key) => key !== current.key).map((key) => byKey.get(key)!).sort(compareRecent)
}

const DAY_MS = 86_400_000

// Treat ISO date-only strings as calendar days, independent of UTC offsets/DST.
function calendarDay(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  return date.getTime() / DAY_MS
}

/** Actual counts/work queues, not a scientific quality or completion score. */
export function buildProjectOverview(data: WorkspaceData, today: string): ProjectOverview[] {
  const currentDay = calendarDay(today)
  const claims = new Map(data.claims.map((item) => [item.id, item]))
  const questions = new Map(data.researchQuestions.map((item) => [item.id, item]))
  const linkedQuestions = new Set(data.claimQuestionLinks.filter((item) =>
    claims.get(item.claimId)?.projectId === item.projectId && questions.get(item.researchQuestionId)?.projectId === item.projectId,
  ).map((item) => item.researchQuestionId))
  const submissions = new Map(data.submissions.map((item) => [item.id, item]))
  return data.projects.map((project) => {
    const projectTasks = data.tasks.filter((item) => item.projectId === project.id)
    const pendingTasks = projectTasks.filter((item) => item.status !== 'Done' && item.status !== 'Deferred')
    const openQuestions = data.researchQuestions.filter((item) => item.projectId === project.id && (item.status === 'draft' || item.status === 'active'))
    const siteIds = new Set(data.fieldSites.filter((item) => item.projectId === project.id).map((item) => item.id))
    const mappedSites = new Set(data.fieldMaps.filter((item) => item.projectId === project.id).flatMap((item) =>
      item.markers.filter((marker) => siteIds.has(marker.fieldSiteId)).map((marker) => marker.fieldSiteId),
    ))
    const count = (items: Array<{ projectId: string }>) => items.filter((item) => item.projectId === project.id).length
    return {
      projectId: project.id, title: project.title,
      totalTasks: projectTasks.length, doneTasks: projectTasks.filter((item) => item.status === 'Done').length,
      overdueTasks: currentDay === null ? 0 : pendingTasks.filter((item) => {
        const due = calendarDay(item.dueDate)
        return due !== null && due < currentDay
      }).length,
      upcomingTasks: currentDay === null ? 0 : pendingTasks.filter((item) => {
        const due = calendarDay(item.dueDate)
        return due !== null && due >= currentDay && due <= currentDay + 6
      }).length,
      openQuestions: openQuestions.length, unlinkedQuestions: openQuestions.filter((item) => !linkedQuestions.has(item.id)).length,
      claims: count(data.claims), theoryMemos: count(data.theoryMemos), literature: count(data.literature),
      fieldSites: siteIds.size, mappedSites: mappedSites.size, interviews: count(data.interviews),
      datasets: count(data.datasets), analysisRuns: count(data.analysisRuns), evidence: count(data.evidence), manuscripts: count(data.manuscripts),
      openReviews: data.reviewerComments.filter((item) =>
        submissions.get(item.submissionId)?.projectId === project.id && (item.status === 'Open' || item.status === 'Addressing'),
      ).length,
    }
  })
}
