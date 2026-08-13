import type { ComponentType } from 'react'
import type { MessageKey } from '../i18n'
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarCheck2,
  ChartNoAxesCombined,
  ClipboardList,
  FlaskConical,
  Lightbulb,
  ScrollText,
  Send,
} from 'lucide-react'

export type PrimaryModuleId =
  | 'today'
  | 'projects'
  | 'literature'
  | 'theory'
  | 'fieldwork'
  | 'quantitative'
  | 'evidence'
  | 'research-log'
  | 'publishing'

export type NavigationBadgeId = 'overdue' | 'processing' | 'failed' | 'revision'

export interface SecondaryNavigationItem {
  id: string
  labelKey: MessageKey
  badgeId?: NavigationBadgeId
}

export interface QuickAddAction {
  action: string
  labelKey: MessageKey
}

export interface NavigationItem {
  id: PrimaryModuleId
  path: string
  labelKey: MessageKey
  shortLabelKey: MessageKey
  index: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  views: readonly SecondaryNavigationItem[]
  quickAdd: readonly QuickAddAction[]
}

export const navigationItems: readonly NavigationItem[] = [
  {
    id: 'today', path: '/', labelKey: 'nav.today', shortLabelKey: 'nav.today.short', index: '01', icon: CalendarCheck2,
    views: [
      { id: 'overview', labelKey: 'nav.today.overview' },
      { id: 'tasks', labelKey: 'nav.today.tasks', badgeId: 'overdue' },
      { id: 'week', labelKey: 'nav.today.week' },
    ],
    quickAdd: [{ action: 'task', labelKey: 'quickAdd.task' }],
  },
  {
    id: 'projects', path: '/projects', labelKey: 'nav.projects', shortLabelKey: 'nav.projects.short', index: '02', icon: BriefcaseBusiness,
    views: [
      { id: 'all', labelKey: 'nav.projects.all' },
      { id: 'active', labelKey: 'nav.projects.active' },
      { id: 'theoretical', labelKey: 'nav.projects.theoretical' },
      { id: 'completed', labelKey: 'nav.projects.completed' },
    ],
    quickAdd: [{ action: 'project', labelKey: 'quickAdd.project' }],
  },
  {
    id: 'literature', path: '/literature', labelKey: 'nav.literature', shortLabelKey: 'nav.literature.short', index: '03', icon: BookOpenText,
    views: [
      { id: 'inbox', labelKey: 'nav.literature.inbox' },
      { id: 'reading', labelKey: 'nav.literature.reading' },
      { id: 'cited', labelKey: 'nav.literature.cited' },
      { id: 'all', labelKey: 'nav.literature.all' },
    ],
    quickAdd: [{ action: 'literature', labelKey: 'quickAdd.literature' }],
  },
  {
    id: 'theory', path: '/theory', labelKey: 'nav.theory', shortLabelKey: 'nav.theory.short', index: '04', icon: Lightbulb,
    views: [
      { id: 'overview', labelKey: 'nav.theory.overview' },
      { id: 'questions', labelKey: 'nav.theory.questions' },
      { id: 'memos', labelKey: 'nav.theory.memos' },
      { id: 'manuscripts', labelKey: 'nav.theory.manuscripts' },
    ],
    quickAdd: [{ action: 'theory-memo', labelKey: 'quickAdd.theoryMemo' }],
  },
  {
    id: 'fieldwork', path: '/fieldwork', labelKey: 'nav.fieldwork', shortLabelKey: 'nav.fieldwork.short', index: '05', icon: ClipboardList,
    views: [
      { id: 'overview', labelKey: 'nav.fieldwork.overview' },
      { id: 'field', labelKey: 'nav.fieldwork.field' },
      { id: 'interviews', labelKey: 'nav.fieldwork.interviews' },
      { id: 'processing', labelKey: 'nav.fieldwork.processing', badgeId: 'processing' },
    ],
    quickAdd: [
      { action: 'interview', labelKey: 'quickAdd.interview' },
      { action: 'field-visit', labelKey: 'quickAdd.fieldVisit' },
    ],
  },
  {
    id: 'quantitative', path: '/quantitative', labelKey: 'nav.quantitative', shortLabelKey: 'nav.quantitative.short', index: '06', icon: ChartNoAxesCombined,
    views: [
      { id: 'overview', labelKey: 'nav.quantitative.overview' },
      { id: 'datasets', labelKey: 'nav.quantitative.datasets' },
      { id: 'runs', labelKey: 'nav.quantitative.runs', badgeId: 'failed' },
    ],
    quickAdd: [{ action: 'analysis-run', labelKey: 'quickAdd.analysisRun' }],
  },
  {
    id: 'evidence', path: '/evidence', labelKey: 'nav.evidence', shortLabelKey: 'nav.evidence.short', index: '07', icon: FlaskConical,
    views: [
      { id: 'all', labelKey: 'nav.evidence.all' },
      { id: 'by-type', labelKey: 'nav.evidence.byType' },
      { id: 'contradictory', labelKey: 'nav.evidence.contradictory' },
    ],
    quickAdd: [{ action: 'evidence', labelKey: 'quickAdd.evidence' }],
  },
  {
    id: 'research-log', path: '/research-log', labelKey: 'nav.researchLog', shortLabelKey: 'nav.researchLog.short', index: '08', icon: ScrollText,
    views: [
      { id: 'timeline', labelKey: 'nav.researchLog.timeline' },
      { id: 'decisions', labelKey: 'nav.researchLog.decisions' },
      { id: 'next-steps', labelKey: 'nav.researchLog.nextSteps' },
    ],
    quickAdd: [{ action: 'research-log', labelKey: 'quickAdd.researchLog' }],
  },
  {
    id: 'publishing', path: '/publishing', labelKey: 'nav.publishing', shortLabelKey: 'nav.publishing.short', index: '09', icon: Send,
    views: [
      { id: 'writing', labelKey: 'nav.publishing.writing' },
      { id: 'submission', labelKey: 'nav.publishing.submission' },
      { id: 'revision', labelKey: 'nav.publishing.revision', badgeId: 'revision' },
      { id: 'history', labelKey: 'nav.publishing.history' },
    ],
    quickAdd: [
      { action: 'manuscript', labelKey: 'quickAdd.manuscript' },
      { action: 'submission', labelKey: 'quickAdd.submission' },
    ],
  },
] as const

interface LegacyViewAlias {
  view: string
  filters?: Readonly<Record<string, string>>
}

/**
 * v0.2.1 bookmarks remain meaningful after the sidebar is simplified. The
 * mapping changes presentation only: raw domain statuses and workspace data
 * are never rewritten.
 */
export const legacyViewAliases: Readonly<Record<PrimaryModuleId, Readonly<Record<string, LegacyViewAlias>>>> = {
  today: {
    overdue: { view: 'tasks', filters: { filter: 'overdue' } },
    completed: { view: 'tasks', filters: { filter: 'completed' } },
  },
  projects: {
    design: { view: 'active', filters: { status: 'Design' } },
    data: { view: 'active', filters: { status: 'Data / Fieldwork' } },
    analysis: { view: 'active', filters: { status: 'Analysis' } },
    writing: { view: 'active', filters: { status: 'Writing' } },
    submission: { view: 'active', filters: { status: 'Submission,Revision' } },
  },
  literature: {
    'to-read': { view: 'reading', filters: { status: 'To Read' } },
    read: { view: 'reading', filters: { status: 'Read' } },
    archived: { view: 'all', filters: { status: 'Archived' } },
  },
  theory: {
    concepts: { view: 'memos', filters: { type: 'concept' } },
    mechanisms: { view: 'memos', filters: { type: 'mechanism' } },
    dialogue: { view: 'memos', filters: { type: 'dialogue' } },
    counterarguments: { view: 'memos', filters: { type: 'counterargument,boundary' } },
  },
  fieldwork: {
    sites: { view: 'field', filters: { tab: 'sites' } },
    visits: { view: 'field', filters: { tab: 'visits' } },
    transcription: { view: 'processing', filters: { stage: 'transcription' } },
    coding: { view: 'processing', filters: { stage: 'coding' } },
    memos: { view: 'processing', filters: { stage: 'memos' } },
    completed: { view: 'processing', filters: { stage: 'completed' } },
  },
  quantitative: {
    planned: { view: 'runs', filters: { status: 'Planned' } },
    running: { view: 'runs', filters: { status: 'Running' } },
    completed: { view: 'runs', filters: { status: 'Completed' } },
    failed: { view: 'runs', filters: { status: 'Failed' } },
    superseded: { view: 'runs', filters: { status: 'Superseded' } },
  },
  evidence: {
    literature: { view: 'by-type', filters: { type: 'Literature' } },
    quantitative: { view: 'by-type', filters: { type: 'Quantitative Result' } },
    fieldwork: { view: 'by-type', filters: { type: 'Interview,Fieldnote' } },
    documents: { view: 'by-type', filters: { type: 'Policy / Document' } },
    'by-project': { view: 'all', filters: { scope: 'project' } },
  },
  'research-log': {
    today: { view: 'timeline', filters: { period: 'today' } },
    week: { view: 'timeline', filters: { period: 'week' } },
    problems: { view: 'timeline', filters: { issues: 'true' } },
    'by-project': { view: 'timeline', filters: { scope: 'project' } },
  },
  publishing: {
    all: { view: 'history', filters: { scope: 'all' } },
    draft: { view: 'writing', filters: { status: 'Idea,Outline,Drafting,Internal Review' } },
    ready: { view: 'writing', filters: { status: 'Ready to Submit' } },
    submitted: { view: 'submission', filters: { status: 'Submitted' } },
    review: { view: 'submission', filters: { status: 'Under Review' } },
    rejected: { view: 'history', filters: { status: 'Rejected,Reworking' } },
    accepted: { view: 'history', filters: { status: 'Accepted' } },
    published: { view: 'history', filters: { status: 'Published' } },
    withdrawn: { view: 'history', filters: { status: 'Withdrawn' } },
  },
}

export function getNavigationItem(pathname: string) {
  return navigationItems.find((item) => item.path === pathname) ?? navigationItems[0]
}

export function normalizeModuleSearch(moduleId: PrimaryModuleId, search: string | URLSearchParams) {
  const normalized = new URLSearchParams(search)
  const zoteroHandoff = moduleId === 'literature' ? normalized.get('zotero-handoff') : null
  const item = navigationItems.find((candidate) => candidate.id === moduleId) ?? navigationItems[0]
  const requested = normalized.get('view')
  const alias = requested ? legacyViewAliases[moduleId][requested] : undefined

  if (alias) {
    normalized.set('view', alias.view)
    Object.entries(alias.filters ?? {}).forEach(([key, value]) => normalized.set(key, value))
  } else if (!requested || !item.views.some((view) => view.id === requested)) {
    normalized.set('view', item.views[0].id)
  }

  if (zoteroHandoff) normalized.set('zotero-handoff', zoteroHandoff)

  return normalized
}

export function getActiveView(item: NavigationItem, search: string) {
  const requested = normalizeModuleSearch(item.id, search).get('view')
  return item.views.find((view) => view.id === requested) ?? item.views[0]
}

export function toNavigationView(item: NavigationItem, viewId = item.views[0].id) {
  return `${item.path}?view=${encodeURIComponent(viewId)}`
}
