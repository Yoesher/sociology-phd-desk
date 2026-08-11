import type { ComponentType } from 'react'
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
  label: string
  shortLabel: string
  index: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

export const navigationItems: NavigationItem[] = [
  { path: '/', label: 'Today', shortLabel: 'Today', index: '01', icon: CalendarCheck2 },
  { path: '/projects', label: 'Projects', shortLabel: 'Projects', index: '02', icon: BriefcaseBusiness },
  { path: '/literature', label: 'Literature', shortLabel: 'Reading', index: '03', icon: BookOpenText },
  { path: '/fieldwork', label: 'Fieldwork', shortLabel: 'Field', index: '04', icon: ClipboardList },
  { path: '/quantitative', label: 'Quantitative', shortLabel: 'Quant', index: '05', icon: ChartNoAxesCombined },
  { path: '/evidence', label: 'Evidence', shortLabel: 'Evidence', index: '06', icon: FlaskConical },
  { path: '/research-log', label: 'Research Log', shortLabel: 'Log', index: '07', icon: ScrollText },
  { path: '/manuscripts', label: 'Manuscripts', shortLabel: 'Writing', index: '08', icon: FilePenLine },
  { path: '/submissions', label: 'Submissions', shortLabel: 'Submit', index: '09', icon: Send },
]
