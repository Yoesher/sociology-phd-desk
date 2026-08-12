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
  Lightbulb,
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
  { path: '/theory', labelKey: 'nav.theory', shortLabelKey: 'nav.theory.short', index: '04', icon: Lightbulb },
  { path: '/fieldwork', labelKey: 'nav.fieldwork', shortLabelKey: 'nav.fieldwork.short', index: '05', icon: ClipboardList },
  { path: '/quantitative', labelKey: 'nav.quantitative', shortLabelKey: 'nav.quantitative.short', index: '06', icon: ChartNoAxesCombined },
  { path: '/evidence', labelKey: 'nav.evidence', shortLabelKey: 'nav.evidence.short', index: '07', icon: FlaskConical },
  { path: '/research-log', labelKey: 'nav.researchLog', shortLabelKey: 'nav.researchLog.short', index: '08', icon: ScrollText },
  { path: '/manuscripts', labelKey: 'nav.manuscripts', shortLabelKey: 'nav.manuscripts.short', index: '09', icon: FilePenLine },
  { path: '/submissions', labelKey: 'nav.submissions', shortLabelKey: 'nav.submissions.short', index: '10', icon: Send },
]
