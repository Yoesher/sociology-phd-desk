import type { ComponentType } from 'react'
import type { MessageKey } from '../i18n'
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarCheck2,
  ChartNoAxesCombined,
  ClipboardList,
  FilePenLine,
  FlaskConical,
  ScrollText,
  Send,
} from 'lucide-react'

export interface NavigationItem {
  path: string
  labelKey: MessageKey
  shortLabelKey: MessageKey
  index: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

export const navigationItems: NavigationItem[] = [
  { path: '/', labelKey: 'nav.today', shortLabelKey: 'nav.today.short', index: '01', icon: CalendarCheck2 },
  { path: '/projects', labelKey: 'nav.projects', shortLabelKey: 'nav.projects.short', index: '02', icon: BriefcaseBusiness },
  { path: '/literature', labelKey: 'nav.literature', shortLabelKey: 'nav.literature.short', index: '03', icon: BookOpenText },
  { path: '/fieldwork', labelKey: 'nav.fieldwork', shortLabelKey: 'nav.fieldwork.short', index: '04', icon: ClipboardList },
  { path: '/quantitative', labelKey: 'nav.quantitative', shortLabelKey: 'nav.quantitative.short', index: '05', icon: ChartNoAxesCombined },
  { path: '/evidence', labelKey: 'nav.evidence', shortLabelKey: 'nav.evidence.short', index: '06', icon: FlaskConical },
  { path: '/research-log', labelKey: 'nav.researchLog', shortLabelKey: 'nav.researchLog.short', index: '07', icon: ScrollText },
  { path: '/manuscripts', labelKey: 'nav.manuscripts', shortLabelKey: 'nav.manuscripts.short', index: '08', icon: FilePenLine },
  { path: '/submissions', labelKey: 'nav.submissions', shortLabelKey: 'nav.submissions.short', index: '09', icon: Send },
]
