import { z } from 'zod'
import { CLAIM_STATUSES, EVIDENCE_TYPES, SUPPORT_LEVELS, THEORY_MEMO_TYPES } from '../models/domain'
import { LEGACY_COLLECTION_KEYS, QUALITATIVE_COLLECTION_KEYS, SHARED_PROVENANCE_COLLECTION_KEYS } from '../models/provenance'

const id = z.string().min(1).max(500).refine(value => value.trim().length > 0, 'ID cannot be blank')
const text = z.string().max(50_000)
// Revision snapshots retain the accepted v7 field budgets exactly.
const legacyText = z.string().max(250_000)
const short = z.string().min(1).max(500).refine(value => value.trim().length > 0, 'Metadata label or token cannot be blank')
const date = z.string().refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'Expected an ISO date-time with a timezone')
const state = z.enum(['active', 'archived', 'withdrawn'])
const edgeState = z.enum(['active', 'retired'])
const unit = z.enum(['household', 'person', 'episode', 'group', 'other'])
const base = { id, createdAt: date, updatedAt: date, isDemo: z.boolean(), projectId: id }
const revision = { ...base, revisionNo: z.number().int().positive(), previousRevisionId: id.optional(), changeReason: text }
const edge = { ...base, state: edgeState }
const attributes = z.array(z.object({ dimensionId: id, categoryId: id }).strict()).max(100)
const claimSnapshot = z.object({ text: legacyText, status: z.enum(CLAIM_STATUSES), notes: legacyText }).strict()
const evidenceSnapshot = z.object({ claim: legacyText, evidenceType: z.enum(EVIDENCE_TYPES), source: legacyText, locator: legacyText, finding: legacyText, supportLevel: z.enum(SUPPORT_LEVELS), limitations: legacyText, manuscriptLocation: legacyText }).strict()
const memoSnapshot = z.object({ memoType: z.enum(THEORY_MEMO_TYPES), title: z.string().min(1).max(1000), content: legacyText, relatedQuestionIds: z.array(id), relatedClaimIds: z.array(id), relatedLiteratureIds: z.array(id) }).strict()
const origin = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literature'), literatureId: id, locator: text }).strict(),
  z.object({ kind: z.literal('analysisRun'), analysisRunId: id, locator: text }).strict(),
  z.object({ kind: z.literal('interview'), interviewId: id, locator: text }).strict(),
  z.object({ kind: z.literal('fieldVisit'), fieldVisitId: id, locator: text }).strict(),
  z.object({ kind: z.literal('sourceSegmentRevision'), segmentRevisionId: id }).strict(),
])
const originV8 = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literature'), literatureId: id, locator: text }).strict(),
  z.object({ kind: z.literal('analysisRun'), analysisRunId: id, locator: text }).strict(),
  z.object({ kind: z.literal('interview'), interviewId: id, locator: text }).strict(),
  z.object({ kind: z.literal('fieldVisit'), fieldVisitId: id, locator: text }).strict(),
])
const owner = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interview'), interviewId: id }).strict(),
  z.object({ kind: z.literal('fieldVisit'), fieldVisitId: id }).strict(),
])
export const externalReferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local-token'), token: short }).strict(),
  z.object({ kind: z.literal('https-reference'), url: z.string().max(2048).url().refine(value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false } }, 'Use an HTTPS reference without embedded credentials') }).strict(),
  z.object({ kind: z.literal('qda-reference'), provider: z.enum(['nvivo', 'maxqda', 'atlas-ti', 'other']), projectToken: short, sourceToken: short, objectToken: short.optional() }).strict(),
])
export const segmentLocatorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lineRange'), start: z.number().int().positive(), end: z.number().int().positive() }).strict().refine(value => value.end >= value.start, 'Reversed line range'),
  z.object({ kind: z.literal('pageParagraph'), page: z.number().int().positive(), paragraphStart: z.number().int().positive(), paragraphEnd: z.number().int().positive() }).strict().refine(value => value.paragraphEnd >= value.paragraphStart, 'Reversed paragraph range'),
  z.object({ kind: z.literal('timeRange'), startMs: z.number().int().nonnegative(), endMs: z.number().int().positive() }).strict().refine(value => value.endMs > value.startMs, 'Empty or reversed time range'),
  z.object({ kind: z.literal('externalAnchor'), namespace: short, token: short }).strict(),
])
const material = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('segmentRevision'), segmentRevisionId: id }).strict(),
  z.object({ kind: z.literal('codingAssignment'), assignmentId: id }).strict(),
  z.object({ kind: z.literal('codeRevision'), codeRevisionId: id }).strict(),
  z.object({ kind: z.literal('comparisonRun'), comparisonRunId: id }).strict(),
  z.object({ kind: z.literal('interview'), interviewId: id }).strict(),
  z.object({ kind: z.literal('fieldVisit'), fieldVisitId: id }).strict(),
  z.object({ kind: z.literal('researchCase'), caseId: id }).strict(),
])
const assignmentState = z.enum(['active', 'superseded', 'retracted'])
const rows = {
  claimRevisions: z.object({ ...revision, claimId: id, snapshot: claimSnapshot }).strict(),
  evidenceRevisions: z.object({ ...revision, evidenceId: id, snapshot: evidenceSnapshot }).strict(),
  evidenceClaimLinks: z.object({ ...edge, evidenceRevisionId: id, claimRevisionId: id, supportLevel: z.enum(SUPPORT_LEVELS), rationale: text, limitations: text }).strict(),
  evidenceSourceLinks: z.object({ ...edge, evidenceRevisionId: id, origin, role: z.enum(['primary', 'corroborating', 'context']) }).strict(),
  manuscriptAnchors: z.object({ ...base, manuscriptId: id, kind: z.enum(['section', 'paragraph', 'table', 'figure']), currentRevisionId: id, state }).strict(),
  manuscriptAnchorRevisions: z.object({ ...revision, anchorId: id, documentVersion: short, sectionPath: z.array(short).min(1).max(20), paragraphLabel: short.optional(), bookmarkToken: short.optional(), externalReferenceToken: short.optional(), locatorVerifiedAt: date.optional() }).strict(),
  claimManuscriptLinks: z.object({ ...edge, claimRevisionId: id, anchorRevisionId: id, purpose: z.enum(['assertion', 'discussion', 'boundary', 'counterargument']) }).strict(),
  evidenceUsages: z.object({ ...edge, evidenceClaimLinkId: id, claimManuscriptLinkId: id, useKind: z.enum(['summary', 'quotation-reference', 'table-reference', 'context']), note: text }).strict(),
  samplingDimensions: z.object({ ...base, label: short, unit, categories: z.array(z.object({ id, label: short, retired: z.boolean() }).strict()).min(1).max(500), state }).strict(),
  researchCases: z.object({ ...base, alias: short, unit, attributes, state }).strict(),
  interviewCaseLinks: z.object({ ...edge, interviewId: id, caseId: id, role: z.enum(['primary', 'member', 'context']) }).strict(),
  sourceReferences: z.object({ ...base, alias: short, sourceKind: z.enum(['transcript', 'fieldnote', 'qda-export-reference']), owners: z.array(owner).min(1).max(100), currentRevisionId: id, state }).strict(),
  sourceRevisions: z.object({ ...revision, sourceReferenceId: id, versionLabel: short, externalRef: externalReferenceSchema, contentDigest: z.object({ algorithm: z.literal('SHA-256'), value: z.string().regex(/^[a-fA-F0-9]{64}$/) }).strict().optional(), researcherVerification: z.enum(['unverified', 'verified']) }).strict(),
  sourceSegments: z.object({ ...base, sourceReferenceId: id, label: short, currentRevisionId: id, state }).strict(),
  sourceSegmentRevisions: z.object({ ...revision, segmentId: id, sourceRevisionId: id, primaryLocator: segmentLocatorSchema, alternateLocators: z.array(segmentLocatorSchema).max(20), verification: z.enum(['unverified', 'verified', 'unresolved']) }).strict(),
  qualitativeCodes: z.object({ ...base, currentRevisionId: id, state }).strict(),
  qualitativeCodeRevisions: z.object({ ...revision, codeId: id, label: short, stage: z.enum(['initial', 'theme']), definition: text, inclusion: text, exclusion: text }).strict(),
  codeRelations: z.object({ ...edge, fromCodeRevisionId: id, toCodeRevisionId: id, kind: z.enum(['groups', 'related', 'split-from', 'merged-from']), rationale: text }).strict(),
  codingAssignments: z.object({ ...base, segmentRevisionId: id, codeRevisionId: id, researcherAlias: short, state: assignmentState, previousAssignmentId: id.optional(), rationale: text }).strict(),
  analyticalMemoFacets: z.object({ ...base, theoryMemoId: id, currentRevisionId: id, analysisKind: z.enum(['code-development', 'case-comparison', 'mechanism', 'negative-case']), state }).strict(),
  theoryMemoRevisions: z.object({ ...revision, theoryMemoId: id, snapshot: memoSnapshot }).strict(),
  memoMaterialLinks: z.object({ ...edge, memoRevisionId: id, material, role: z.enum(['observation', 'interpretation', 'rival', 'boundary']), note: text }).strict(),
  claimDerivationLinks: z.object({ ...edge, claimRevisionId: id, memoRevisionId: id, rationale: text }).strict(),
  comparisonRuns: z.object({ ...base, title: short, frozenAt: date, researcherAlias: short, caseSnapshots: z.array(z.object({ id, alias: short, unit, attributes }).strict()).min(1).max(1000), codeRevisionIds: z.array(id).min(1).max(1000), eligibleInterviewIds: z.array(id).max(25_000), caseInterviewPairs: z.array(z.object({ caseId: id, interviewId: id }).strict()).max(25_000), assignmentStatesAtFreeze: z.array(z.object({ assignmentId: id, state: assignmentState }).strict()).max(25_000), rule: z.object({ unit, deduplicateBy: z.literal('caseId'), includeSuperseded: z.boolean() }).strict(), cells: z.array(z.object({ caseId: id, codeRevisionId: id, state: z.enum(['present', 'absent-reviewed', 'not-examined', 'not-applicable', 'unresolved']), assignmentIds: z.array(id), reviewedSegmentRevisionIds: z.array(id), reviewNote: text.optional() }).strict()).max(10_000) }).strict(),
  qualitativeChangeEvents: z.object({ ...base, operation: z.enum(['create', 'revise', 'recode', 'merge', 'split', 'archive', 'withdraw', 'unlink', 'reanchor']), affected: z.array(z.object({ collection: short, id }).strict()).min(1), reason: text, researcherAlias: short }).strict(),
}
export const provenanceRowSchemas = rows
export const provenanceCollectionSchemas = Object.fromEntries(Object.entries(rows).map(([key, schema]) => [key, z.array(schema).max(25_000)])) as { [K in keyof typeof rows]: z.ZodArray<(typeof rows)[K]> }
export const sharedProvenanceCollectionSchemas = {
  claimRevisions: provenanceCollectionSchemas.claimRevisions,
  evidenceRevisions: provenanceCollectionSchemas.evidenceRevisions,
  evidenceClaimLinks: provenanceCollectionSchemas.evidenceClaimLinks,
  evidenceSourceLinks: z.array(rows.evidenceSourceLinks.extend({ origin: originV8 })).max(25_000),
  manuscriptAnchors: provenanceCollectionSchemas.manuscriptAnchors,
  manuscriptAnchorRevisions: provenanceCollectionSchemas.manuscriptAnchorRevisions,
  claimManuscriptLinks: provenanceCollectionSchemas.claimManuscriptLinks,
  evidenceUsages: provenanceCollectionSchemas.evidenceUsages,
}

/** Deterministic namespace hash for migration IDs, never a document digest. */
function migrationId(kind: string, rootId: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify(['spd-v8-initial-revision', kind, rootId, 1]))
  const words = [2166136261, 2246822519, 3266489917, 668265263]
  for (const byte of bytes) for (let index = 0; index < words.length; index++) words[index] = Math.imul((words[index] ?? 0) ^ byte, 16777619 + index * 2) >>> 0
  return 'migrated-v8-' + words.map(word => word.toString(16).padStart(8, '0')).join('')
}
function migrationInput(input: unknown, version: number): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid migration input')
  const data = input as Record<string, unknown>
  if (data.application !== 'sociology-phd-desk' || data.version !== version) throw new Error(`Migration requires workspace v${version}`)
  const allowed = new Set<string>(['application', 'version', 'exportedAt', 'workspace', ...LEGACY_COLLECTION_KEYS, ...(version === 8 ? SHARED_PROVENANCE_COLLECTION_KEYS : [])])
  if (Object.keys(data).some(key => !allowed.has(key))) throw new Error(`Unknown workspace v${version} field`)
  for (const key of [...LEGACY_COLLECTION_KEYS, ...(version === 8 ? SHARED_PROVENANCE_COLLECTION_KEYS : [])]) if (!Array.isArray(data[key])) throw new Error(`Missing workspace v${version} collection ${key}`)
  return structuredClone(data)
}
export function migrateWorkspaceV7ToV8(input: unknown): unknown {
  const data = migrationInput(input, 7)
  for (const key of SHARED_PROVENANCE_COLLECTION_KEYS) data[key] = []
  const used = new Set<string>()
  for (const value of Object.values(data)) if (Array.isArray(value)) for (const row of value) if (row && typeof row === 'object' && 'id' in row) used.add(String(row.id))
  for (const [collection, target, parent, fields] of [
    ['claims', 'claimRevisions', 'claimId', ['text', 'status', 'notes']],
    ['evidence', 'evidenceRevisions', 'evidenceId', ['claim', 'evidenceType', 'source', 'locator', 'finding', 'supportLevel', 'limitations', 'manuscriptLocation']],
  ] as const) {
    const roots = data[collection]
    if (!Array.isArray(roots)) throw new Error(`Missing legacy collection ${collection}`)
    for (const row of [...roots].sort((left, right) => String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0)) {
      const initialId = migrationId(collection, row.id)
      let revisionId = initialId, suffix = 0
      while (used.has(revisionId)) revisionId = `${initialId}-${++suffix}`
      used.add(revisionId)
      ;(data[target] as unknown[]).push({ id: revisionId, projectId: row.projectId, createdAt: row.updatedAt, updatedAt: row.updatedAt, isDemo: row.isDemo, revisionNo: 1, changeReason: 'legacy snapshot', [parent]: row.id, snapshot: Object.fromEntries(fields.map(field => [field, structuredClone(row[field])])) })
    }
  }
  data.version = 8
  return data
}
export function migrateWorkspaceV8ToV9(input: unknown): unknown {
  const data = migrationInput(input, 8)
  for (const key of QUALITATIVE_COLLECTION_KEYS) data[key] = []
  data.version = 9
  return data
}
