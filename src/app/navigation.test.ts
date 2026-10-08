import { describe, expect, it } from 'vitest'
import { legacyViewAliases, navigationItems, normalizeModuleSearch } from './navigation'

describe('simplified navigation contract', () => {
  it('keeps nine research domains and 35 workflow views including qualitative and evidence provenance', () => {
    expect(navigationItems).toHaveLength(9)
    expect(navigationItems.map((item) => item.views.length)).toEqual([3, 4, 4, 4, 6, 3, 4, 3, 4])
    expect(navigationItems.reduce((count, item) => count + item.views.length, 0)).toBe(35)
    expect(normalizeModuleSearch('fieldwork', 'view=maps').get('view')).toBe('maps')
  })

  it.each([
    ['today', 'overdue', 'tasks', 'filter', 'overdue'],
    ['projects', 'analysis', 'active', 'status', 'Analysis'],
    ['literature', 'archived', 'all', 'status', 'Archived'],
    ['theory', 'mechanisms', 'memos', 'type', 'mechanism'],
    ['fieldwork', 'coding', 'processing', 'stage', 'coding'],
    ['quantitative', 'failed', 'runs', 'status', 'Failed'],
    ['evidence', 'documents', 'by-type', 'type', 'Policy / Document'],
    ['research-log', 'problems', 'timeline', 'issues', 'true'],
    ['publishing', 'published', 'history', 'status', 'Published'],
  ] as const)('maps legacy %s/%s links into a canonical view and URL filter', (module, legacy, view, key, value) => {
    const normalized = normalizeModuleSearch(module, `view=${legacy}`)
    expect(normalized.get('view')).toBe(view)
    expect(normalized.get(key)).toBe(value)
  })

  it('keeps unrelated URL filters while canonicalizing and exposes every module mapping', () => {
    expect(Object.keys(legacyViewAliases)).toEqual(navigationItems.map((item) => item.id))
    const normalized = normalizeModuleSearch('today', 'view=overdue&project=project-1')
    expect(normalized.get('project')).toBe('project-1')
  })

  it('canonicalizes every v0.2.1 alias to a live view without dropping its filters', () => {
    for (const item of navigationItems) {
      for (const [legacy, alias] of Object.entries(legacyViewAliases[item.id])) {
        const normalized = normalizeModuleSearch(item.id, `view=${legacy}&project=project-1`)
        expect(item.views.some((view) => view.id === normalized.get('view'))).toBe(true)
        expect(normalized.get('project')).toBe('project-1')
        for (const [key, value] of Object.entries(alias.filters ?? {})) {
          expect(normalized.get(key)).toBe(value)
        }
      }
    }
  })
})
