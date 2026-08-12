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

export type NavigationBadgeId =
  | 'overdue'
  | 'to-read'
  | 'transcription'
  | 'coding'
  | 'failed'
  | 'revision'

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
      { id: 'tasks', labelKey: 'nav.today.tasks' },
      { id: 'overdue', labelKey: 'nav.today.overdue', badgeId: 'overdue' },
      { id: 'week', labelKey: 'nav.today.week' },
      { id: 'completed', labelKey: 'nav.today.completed' },
    ],
    quickAdd: [{ action: 'task', labelKey: 'quickAdd.task' }],
  },
  {
    id: 'projects', path: '/projects', labelKey: 'nav.projects', shortLabelKey: 'nav.projects.short', index: '02', icon: BriefcaseBusiness,
    views: [
      { id: 'all', labelKey: 'nav.projects.all' },
      { id: 'design', labelKey: 'nav.projects.design' },
      { id: 'data', labelKey: 'nav.projects.data' },
      { id: 'analysis', labelKey: 'nav.projects.analysis' },
      { id: 'writing', labelKey: 'nav.projects.writing' },
      { id: 'submission', labelKey: 'nav.projects.submission' },
      { id: 'theoretical', labelKey: 'nav.projects.theoretical' },
      { id: 'completed', labelKey: 'nav.projects.completed' },
    ],
    quickAdd: [{ action: 'project', labelKey: 'quickAdd.project' }],
  },
  {
    id: 'literature', path: '/literature', labelKey: 'nav.literature', shortLabelKey: 'nav.literature.short', index: '03', icon: BookOpenText,
    views: [
      { id: 'all', labelKey: 'nav.literature.all' },
      { id: 'inbox', labelKey: 'nav.literature.inbox' },
      { id: 'to-read', labelKey: 'nav.literature.toRead', badgeId: 'to-read' },
      { id: 'reading', labelKey: 'nav.literature.reading' },
      { id: 'read', labelKey: 'nav.literature.read' },
      { id: 'cited', labelKey: 'nav.literature.cited' },
      { id: 'archived', labelKey: 'nav.literature.archived' },
    ],
    quickAdd: [{ action: 'literature', labelKey: 'quickAdd.literature' }],
  },
  {
    id: 'theory', path: '/theory', labelKey: 'nav.theory', shortLabelKey: 'nav.theory.short', index: '04', icon: Lightbulb,
    views: [
      { id: 'overview', labelKey: 'nav.theory.overview' },
      { id: 'questions', labelKey: 'nav.theory.questions' },
      { id: 'concepts', labelKey: 'nav.theory.concepts' },
      { id: 'mechanisms', labelKey: 'nav.theory.mechanisms' },
      { id: 'dialogue', labelKey: 'nav.theory.dialogue' },
      { id: 'counterarguments', labelKey: 'nav.theory.counterarguments' },
      { id: 'memos', labelKey: 'nav.theory.memos' },
      { id: 'manuscripts', labelKey: 'nav.theory.manuscripts' },
    ],
    quickAdd: [{ action: 'theory-memo', labelKey: 'quickAdd.theoryMemo' }],
  },
  {
    id: 'fieldwork', path: '/fieldwork', labelKey: 'nav.fieldwork', shortLabelKey: 'nav.fieldwork.short', index: '05', icon: ClipboardList,
    views: [
      { id: 'overview', labelKey: 'nav.fieldwork.overview' },
      { id: 'sites', labelKey: 'nav.fieldwork.sites' },
      { id: 'visits', labelKey: 'nav.fieldwork.visits' },
      { id: 'interviews', labelKey: 'nav.fieldwork.interviews' },
      { id: 'transcription', labelKey: 'nav.fieldwork.transcription', badgeId: 'transcription' },
      { id: 'coding', labelKey: 'nav.fieldwork.coding', badgeId: 'coding' },
      { id: 'memos', labelKey: 'nav.fieldwork.memos' },
      { id: 'completed', labelKey: 'nav.fieldwork.completed' },
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
      { id: 'planned', labelKey: 'nav.quantitative.planned' },
      { id: 'running', labelKey: 'nav.quantitative.running' },
      { id: 'completed', labelKey: 'nav.quantitative.completed' },
      { id: 'failed', labelKey: 'nav.quantitative.failed', badgeId: 'failed' },
      { id: 'superseded', labelKey: 'nav.quantitative.superseded' },
    ],
    quickAdd: [{ action: 'analysis-run', labelKey: 'quickAdd.analysisRun' }],
  },
  {
    id: 'evidence', path: '/evidence', labelKey: 'nav.evidence', shortLabelKey: 'nav.evidence.short', index: '07', icon: FlaskConical,
    views: [
      { id: 'all', labelKey: 'nav.evidence.all' },
      { id: 'literature', labelKey: 'nav.evidence.literature' },
      { id: 'quantitative', labelKey: 'nav.evidence.quantitative' },
      { id: 'fieldwork', labelKey: 'nav.evidence.fieldwork' },
      { id: 'documents', labelKey: 'nav.evidence.documents' },
      { id: 'contradictory', labelKey: 'nav.evidence.contradictory' },
      { id: 'by-project', labelKey: 'nav.evidence.byProject' },
    ],
    quickAdd: [{ action: 'evidence', labelKey: 'quickAdd.evidence' }],
  },
  {
    id: 'research-log', path: '/research-log', labelKey: 'nav.researchLog', shortLabelKey: 'nav.researchLog.short', index: '08', icon: ScrollText,
    views: [
      { id: 'timeline', labelKey: 'nav.researchLog.timeline' },
      { id: 'today', labelKey: 'nav.researchLog.today' },
      { id: 'week', labelKey: 'nav.researchLog.week' },
      { id: 'decisions', labelKey: 'nav.researchLog.decisions' },
      { id: 'problems', labelKey: 'nav.researchLog.problems' },
      { id: 'next-steps', labelKey: 'nav.researchLog.nextSteps' },
      { id: 'by-project', labelKey: 'nav.researchLog.byProject' },
    ],
    quickAdd: [{ action: 'research-log', labelKey: 'quickAdd.researchLog' }],
  },
  {
    id: 'publishing', path: '/publishing', labelKey: 'nav.publishing', shortLabelKey: 'nav.publishing.short', index: '09', icon: Send,
    views: [
      { id: 'all', labelKey: 'nav.publishing.all' },
      { id: 'draft', labelKey: 'nav.publishing.drafts' },
      { id: 'ready', labelKey: 'nav.publishing.ready' },
      { id: 'submitted', labelKey: 'nav.publishing.submitted' },
      { id: 'review', labelKey: 'nav.publishing.underReview' },
      { id: 'revision', labelKey: 'nav.publishing.revision', badgeId: 'revision' },
      { id: 'rejected', labelKey: 'nav.publishing.rejected' },
      { id: 'accepted', labelKey: 'nav.publishing.accepted' },
      { id: 'published', labelKey: 'nav.publishing.published' },
      { id: 'withdrawn', labelKey: 'nav.publishing.withdrawn' },
    ],
    quickAdd: [
      { action: 'manuscript', labelKey: 'quickAdd.manuscript' },
      { action: 'submission', labelKey: 'quickAdd.submission' },
    ],
  },
] as const

export function getNavigationItem(pathname: string) {
  return navigationItems.find((item) => item.path === pathname) ?? navigationItems[0]
}

export function getActiveView(item: NavigationItem, search: string) {
  const requested = new URLSearchParams(search).get('view')
  return item.views.find((view) => view.id === requested) ?? item.views[0]
}

export function toNavigationView(item: NavigationItem, viewId = item.views[0].id) {
  return `${item.path}?view=${encodeURIComponent(viewId)}`
}
