import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalizeModuleSearch, type PrimaryModuleId } from '../app/navigation'

export function useModuleSearch(moduleId: PrimaryModuleId) {
  const [source, setSource] = useSearchParams()
  const sourceText = source.toString()
  const searchParams = useMemo(
    () => normalizeModuleSearch(moduleId, sourceText),
    [moduleId, sourceText],
  )
  const normalizedText = searchParams.toString()

  useEffect(() => {
    if (sourceText !== normalizedText) setSource(searchParams, { replace: true })
  }, [normalizedText, searchParams, setSource, sourceText])

  const updateSearch = useCallback((updates: Readonly<Record<string, string | null>>, replace = false) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setSource(next, { replace })
  }, [searchParams, setSource])

  return { searchParams, updateSearch }
}
