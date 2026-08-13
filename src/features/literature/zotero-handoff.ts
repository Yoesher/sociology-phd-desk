import { z } from 'zod'
import type {
  LiteratureExternalReference,
  LiteratureItem,
  LiteratureStatus,
  Priority,
  WorkspaceData,
} from '../../models/domain'

export const ZOTERO_HANDOFF_APPLICATION = 'sociology-phd-desk-zotero' as const
export const ZOTERO_HANDOFF_VERSION = 1 as const
export const ZOTERO_HANDOFF_FILE_EXTENSION = '.spdzotero' as const
export const MAX_ZOTERO_FRAGMENT_CHARACTERS = 12 * 1_024
export const MAX_ZOTERO_BUNDLE_BYTES = 8 * 1_024 * 1_024
export const MAX_ZOTERO_ITEMS = 1_000
export const MAX_ZOTERO_TITLE_LENGTH = 1_000
export const MAX_ZOTERO_ABSTRACT_LENGTH = 250_000
export const MAX_ZOTERO_CREATORS = 1_000
export const MAX_ZOTERO_TAGS = 2_000

export const SUPPORTED_ZOTERO_ITEM_TYPES = [
  'artwork', 'audioRecording', 'bill', 'blogPost', 'book', 'bookSection', 'case',
  'computerProgram', 'conferencePaper', 'dataset', 'dictionaryEntry', 'document',
  'email', 'encyclopediaArticle', 'film', 'forumPost', 'hearing', 'instantMessage',
  'interview', 'journalArticle', 'letter', 'magazineArticle', 'manuscript', 'map',
  'newspaperArticle', 'patent', 'podcast', 'preprint', 'presentation',
  'radioBroadcast', 'report', 'standard', 'statute', 'thesis', 'tvBroadcast',
  'videoRecording', 'webpage',
] as const

const id = z.string().trim().min(1).max(240)
const title = z.string().max(MAX_ZOTERO_TITLE_LENGTH)
const short = z.string().max(5_000)
const long = z.string().max(MAX_ZOTERO_ABSTRACT_LENGTH)
const isoDateTime = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value),
  'Expected an ISO 8601 date-time with a timezone.',
)
const httpUrl = z.string().max(32_000).refine((value) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}, 'Expected an http or https URL.')

export function normalizeDoi(value?: string): string | undefined {
  const normalized = value
    ?.trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .toLowerCase()
  if (!normalized) return undefined
  return /^10\.\d{4,9}\/[\x21-\x7e]+$/i.test(normalized) ? normalized : undefined
}

export function normalizeIsbn(value?: string): string | undefined {
  const normalized = value?.replace(/[^0-9X]/gi, '').toUpperCase()
  return normalized && (normalized.length === 10 || normalized.length === 13)
    ? normalized
    : undefined
}

const zoteroItemSchema = z.object({
  itemKey: id,
  libraryID: z.union([z.string().trim().min(1).max(240), z.number().int().nonnegative()]),
  libraryType: z.string().trim().max(240).optional(),
  itemVersion: z.number().int().nonnegative().optional(),
  itemType: z.enum(SUPPORTED_ZOTERO_ITEM_TYPES),
  title: z.string().trim().min(1).max(MAX_ZOTERO_TITLE_LENGTH),
  creators: z.array(z.object({
    creatorType: z.string().trim().max(240).optional(),
    firstName: title.optional(),
    lastName: title.optional(),
    name: title.optional(),
  }).strict()).max(MAX_ZOTERO_CREATORS),
  date: short.optional(),
  year: z.number().int().min(1000).max(2100).optional(),
  publicationTitle: title.optional(),
  volume: short.optional(),
  issue: short.optional(),
  pages: short.optional(),
  publisher: title.optional(),
  place: title.optional(),
  DOI: z.string().trim().max(500).refine((value) => !value || Boolean(normalizeDoi(value)), 'Invalid DOI.').optional(),
  ISBN: z.string().trim().max(500).optional(),
  ISSN: z.string().trim().max(500).optional(),
  URL: httpUrl.optional(),
  abstractNote: long.optional(),
  tags: z.array(z.string().max(5_000)).max(MAX_ZOTERO_TAGS).optional(),
  collectionKeys: z.array(id).max(2_000).optional(),
  dateAdded: isoDateTime.optional(),
  dateModified: isoDateTime.optional(),
}).strict()

const handoffSchema = z.object({
  application: z.literal(ZOTERO_HANDOFF_APPLICATION),
  version: z.literal(ZOTERO_HANDOFF_VERSION),
  createdAt: isoDateTime,
  items: z.array(zoteroItemSchema).min(1).max(MAX_ZOTERO_ITEMS),
}).strict().superRefine((handoff, context) => {
  const identities = new Set<string>()
  handoff.items.forEach((item, index) => {
    const identity = zoteroSourceIdentity(item)
    if (identities.has(identity)) {
      context.addIssue({
        code: 'custom',
        path: ['items', index, 'itemKey'],
        message: 'Duplicate Zotero library and item key in this handoff.',
      })
    }
    identities.add(identity)
  })
})

export type ZoteroHandoff = z.infer<typeof handoffSchema>
export type ZoteroHandoffItem = ZoteroHandoff['items'][number]
export type ZoteroImportDecision = 'create' | 'refresh' | 'link' | 'skip'

export interface ZoteroImportPreviewItem {
  source: ZoteroHandoffItem
  exactReference?: LiteratureExternalReference
  exactLiterature?: LiteratureItem
  suggestions: LiteratureItem[]
  defaultDecision: ZoteroImportDecision
}

export interface ZoteroImportPreview {
  handoff: ZoteroHandoff
  items: ZoteroImportPreviewItem[]
  exactDuplicates: number
  suggestions: number
  newRecords: number
}

export interface ZoteroImportChoice {
  externalLibraryId: string
  itemKey: string
  decision: ZoteroImportDecision
  literatureItemId?: string
}

export function zoteroSourceIdentity(source: Pick<ZoteroHandoffItem, 'libraryID' | 'itemKey'>): string {
  return `${String(source.libraryID)}\u0000${source.itemKey}`
}

export interface ApplyZoteroImportRequest {
  preview: ZoteroImportPreview
  choices: ZoteroImportChoice[]
  projectId: string
  status: LiteratureStatus
  priority: Priority
  whyRead: string
  now?: Date
  idFactory?: () => string
}

function parseBoundedJson(text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > MAX_ZOTERO_BUNDLE_BYTES) {
    throw new Error('The Zotero handoff exceeds the 8 MiB bundle limit.')
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('The Zotero handoff is not valid JSON.')
  }
}

export function parseZoteroHandoffJson(text: string): ZoteroHandoff {
  const parsed = handoffSchema.safeParse(parseBoundedJson(text))
  if (!parsed.success) {
    throw new Error(`The Zotero handoff failed validation: ${parsed.error.issues[0]?.message ?? 'unknown error'}`)
  }
  return parsed.data
}

export function parseZoteroHandoffFragment(fragmentValue: string): ZoteroHandoff {
  if (!fragmentValue || encodeURIComponent(fragmentValue).length > MAX_ZOTERO_FRAGMENT_CHARACTERS) {
    throw new Error('The Zotero URL handoff exceeds the 12 KiB fragment limit.')
  }
  return parseZoteroHandoffJson(fragmentValue)
}

function creatorName(creator: ZoteroHandoffItem['creators'][number]): string {
  return creator.name?.trim() || [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim()
}

function inferredYear(item: ZoteroHandoffItem): number | undefined {
  if (item.year) return item.year
  const match = item.date?.match(/(?:^|\D)(1\d{3}|20\d{2}|2100)(?:\D|$)/)
  return match ? Number(match[1]) : undefined
}

function normalizedTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function buildZoteroImportPreview(
  workspace: WorkspaceData,
  handoff: ZoteroHandoff,
): ZoteroImportPreview {
  const literatureById = new Map(workspace.literature.map((item) => [item.id, item]))
  const referencesByExternalKey = new Map(
    workspace.literatureExternalReferences.map((reference) => [
      `${reference.provider}\u0000${reference.externalLibraryId}\u0000${reference.externalItemKey}`,
      reference,
    ]),
  )

  const items = handoff.items.map((source): ZoteroImportPreviewItem => {
    const libraryId = String(source.libraryID)
    const exactReference = referencesByExternalKey.get(`zotero\u0000${libraryId}\u0000${source.itemKey}`)
    const exactLiterature = exactReference
      ? literatureById.get(exactReference.literatureItemId)
      : undefined
    const doi = normalizeDoi(source.DOI)
    const year = inferredYear(source)
    const suggestions = exactLiterature
      ? []
      : workspace.literature.filter((record) => {
          const recordDoi = normalizeDoi(record.doi)
          if (doi && recordDoi === doi) return true
          const isbn = normalizeIsbn(source.ISBN)
          if (isbn && normalizeIsbn(record.isbn) === isbn) return true
          return normalizedTitle(record.title) === normalizedTitle(source.title) && record.year === year
        })
    return {
      source,
      exactReference,
      exactLiterature,
      suggestions,
      defaultDecision: exactLiterature ? 'refresh' : suggestions.length ? 'skip' : 'create',
    }
  })

  return {
    handoff,
    items,
    exactDuplicates: items.filter((item) => item.exactLiterature).length,
    suggestions: items.filter((item) => item.suggestions.length > 0).length,
    newRecords: items.filter((item) => item.defaultDecision === 'create').length,
  }
}

function bibliographicFields(source: ZoteroHandoffItem): Pick<
  LiteratureItem,
  | 'title'
  | 'authors'
  | 'itemType'
  | 'year'
  | 'journal'
  | 'volume'
  | 'issue'
  | 'pages'
  | 'publisher'
  | 'place'
  | 'doi'
  | 'isbn'
  | 'issn'
  | 'url'
> {
  return {
    title: source.title.trim(),
    authors: source.creators.map(creatorName).filter(Boolean),
    itemType: source.itemType,
    year: inferredYear(source),
    journal: source.publicationTitle?.trim() || undefined,
    volume: source.volume?.trim() || undefined,
    issue: source.issue?.trim() || undefined,
    pages: source.pages?.trim() || undefined,
    publisher: source.publisher?.trim() || undefined,
    place: source.place?.trim() || undefined,
    doi: normalizeDoi(source.DOI),
    isbn: source.ISBN?.trim() || undefined,
    issn: source.ISSN?.trim() || undefined,
    url: source.URL,
  }
}

export function applyZoteroImport(
  workspace: WorkspaceData,
  request: ApplyZoteroImportRequest,
): WorkspaceData {
  const timestamp = (request.now ?? new Date()).toISOString()
  const choiceByKey = new Map(request.choices.map((choice) => [
    `${choice.externalLibraryId}\u0000${choice.itemKey}`,
    choice,
  ]))
  const nextLiterature = [...workspace.literature]
  const nextReferences = [...workspace.literatureExternalReferences]
  const literatureById = new Map(nextLiterature.map((item) => [item.id, item]))
  const referenceByKey = new Map(nextReferences.map((reference) => [
    `${reference.provider}\u0000${reference.externalLibraryId}\u0000${reference.externalItemKey}`,
    reference,
  ]))
  const createId = request.idFactory ?? (() => crypto.randomUUID())

  request.preview.items.forEach((previewItem) => {
    const libraryId = String(previewItem.source.libraryID)
    const choice = choiceByKey.get(zoteroSourceIdentity(previewItem.source)) ?? {
      externalLibraryId: libraryId,
      itemKey: previewItem.source.itemKey,
      decision: previewItem.defaultDecision,
    }
    if (choice.decision === 'skip') return

    const key = `zotero\u0000${libraryId}\u0000${previewItem.source.itemKey}`
    const existingReference = referenceByKey.get(key)
    if (existingReference && choice.decision !== 'refresh') {
      throw new Error('An existing Zotero source identity can only refresh its linked literature record.')
    }
    const targetId = choice.decision === 'create'
      ? `literature_${createId()}`
      : choice.literatureItemId || existingReference?.literatureItemId || previewItem.exactLiterature?.id
    if (!targetId) throw new Error('A Zotero link or refresh decision requires an existing literature record.')

    const target = literatureById.get(targetId)
    if (choice.decision === 'create') {
      const created: LiteratureItem = {
        id: targetId,
        createdAt: timestamp,
        updatedAt: timestamp,
        isDemo: false,
        ...bibliographicFields(previewItem.source),
        projectId: request.projectId,
        status: request.status,
        priority: request.priority,
        whyRead: request.whyRead,
        notes: '',
      }
      nextLiterature.unshift(created)
      literatureById.set(created.id, created)
    } else if (choice.decision === 'refresh') {
      if (!target) throw new Error('The Zotero refresh target no longer exists.')
      const refreshed = { ...target, ...bibliographicFields(previewItem.source), updatedAt: timestamp }
      nextLiterature[nextLiterature.findIndex((item) => item.id === target.id)] = refreshed
      literatureById.set(target.id, refreshed)
    } else if (!target) {
      throw new Error('The Zotero link target no longer exists.')
    }

    const importedAt = existingReference?.importedAt ?? timestamp
    const reference: LiteratureExternalReference = {
      id: existingReference?.id ?? `literature_external_${createId()}`,
      literatureItemId: targetId,
      provider: 'zotero',
      externalLibraryId: libraryId,
      externalItemKey: previewItem.source.itemKey,
      externalVersion: previewItem.source.itemVersion,
      importedAt,
      lastSeenModifiedAt: previewItem.source.dateModified,
      createdAt: existingReference?.createdAt ?? timestamp,
      updatedAt: timestamp,
      isDemo: false,
    }
    if (existingReference) {
      nextReferences[nextReferences.findIndex((item) => item.id === existingReference.id)] = reference
    } else {
      nextReferences.push(reference)
    }
    referenceByKey.set(key, reference)
  })

  return {
    ...workspace,
    literature: nextLiterature,
    literatureExternalReferences: nextReferences,
  }
}
