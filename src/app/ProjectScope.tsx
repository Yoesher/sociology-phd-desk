import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useWorkspace } from '../hooks/useWorkspace'
import { useI18n } from '../i18n'
import { ProjectScopeContext, useProjectScope } from './project-scope-context'

export function ProjectScopeProvider({ children }: { children: ReactNode }) {
  const { data, setActiveProject } = useWorkspace()
  const scopeRequest = useRef(0)
  const [requested, setRequested] = useState(() => {
    try { return sessionStorage.getItem(`sociology-desk-project-scope:${data?.workspace.id}`) || '' } catch { return '' }
  })
  const projectId = data?.projects.some((project) => project.id === requested) ? requested : ''
  const enter = useCallback(async (id: string) => {
    if (id && !data?.projects.some((project) => project.id === id)) return
    const request = ++scopeRequest.current
    if (id) await setActiveProject(id)
    if (request !== scopeRequest.current) return
    setRequested(id)
    try { sessionStorage.setItem(`sociology-desk-project-scope:${data?.workspace.id}`, id) } catch { /* Scope remains usable for this session. */ }
  }, [data?.projects, data?.workspace.id, setActiveProject])
  const value = useMemo(() => ({ projectId, enter }), [projectId, enter])
  return <ProjectScopeContext.Provider value={value}>{children}</ProjectScopeContext.Provider>
}

export function ProjectScopeBar() {
  const { data } = useWorkspace()
  const { projectId, enter } = useProjectScope()
  const { t } = useI18n()
  if (!data?.projects.length) return null
  return <section className="project-scope-bar" aria-label={t('feedback.project.scope')}>
    <label><span>{t('feedback.project.scope')}</span><select aria-label={t('feedback.project.scope')} value={projectId} onChange={(event) => { void enter(event.target.value).catch(() => undefined) }}>
      <option value="">{t('feedback.project.all')}</option>
      {data.projects.map((project) => <option key={project.id} value={project.id}>{project.shortTitle || project.title}</option>)}
    </select></label>
    <p>{t(projectId ? 'feedback.project.scopedHint' : 'feedback.project.allHint')}</p>
  </section>
}
