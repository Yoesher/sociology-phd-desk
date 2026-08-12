import type { PrimaryModuleId } from './navigation'

export const QUICK_ADD_EVENT = 'sociologydesk:quick-add' as const

export interface QuickAddEventDetail {
  module: PrimaryModuleId
  action: string
}

export type QuickAddEvent = CustomEvent<QuickAddEventDetail>

export function dispatchQuickAdd(detail: QuickAddEventDetail) {
  window.dispatchEvent(new CustomEvent<QuickAddEventDetail>(QUICK_ADD_EVENT, { detail }))
}
