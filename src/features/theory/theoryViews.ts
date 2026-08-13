import type { MessageKey } from '../../i18n'
import type { ResearchProject } from '../../models/domain'

export const THEORY_VIEWS = ['overview', 'questions', 'memos', 'manuscripts'] as const
export type TheoryView = (typeof THEORY_VIEWS)[number]

export const theoryViewLabelKeys = {
  overview: 'theory.views.overview',
  questions: 'theory.views.questions',
  memos: 'theory.views.memos',
  manuscripts: 'theory.views.manuscripts',
} as const satisfies Record<TheoryView, MessageKey>

export function isTheoryView(value: string | null): value is TheoryView {
  return THEORY_VIEWS.some((view) => view === value)
}

export function prioritizeTheoryProjects(projects: ResearchProject[]) {
  return [...projects].sort((left, right) => {
    const methodOrder = Number(right.method === 'Theoretical') - Number(left.method === 'Theoretical')
    return methodOrder || right.updatedAt.localeCompare(left.updatedAt)
  })
}
