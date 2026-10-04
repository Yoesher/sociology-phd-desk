import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Modal } from '../../components/ui'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useProjectScope } from '../../app/project-scope-context'
import { useI18n, type MessageKey } from '../../i18n'
import { domainLabelKeys, type LocalizedDomainValue } from '../../i18n/domainLabels'
import { buildResearchIndex, getRelatedRecords, RECORD_KINDS, searchResearchIndex, type RecordKind } from './research-index'
import { ProjectResearchOverview } from './ProjectResearchOverview'

const PAGE_SIZE = 40
const ENUM_FIELDS = new Set(['method', 'status', 'memoType', 'category', 'priority', 'transcriptStatus', 'codingStatus', 'memoStatus', 'software', 'evidenceType', 'supportLevel', 'severity'])

export function ResearchNavigator({ onClose }: { onClose: () => void }) {
  const { data } = useWorkspace()
  const { projectId: scopeId } = useProjectScope()
  const { t, labelEnum, formatNumber } = useI18n()
  const [view, setView] = useState<'search' | 'overview'>('search')
  const [query, setQuery] = useState('')
  const [allProjects, setAllProjects] = useState(!scopeId)
  const [project, setProject] = useState(scopeId)
  const [kind, setKind] = useState<RecordKind | ''>('')
  const [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState('')
  const [relatedPage, setRelatedPage] = useState(1)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const queryInput = useRef<HTMLInputElement>(null)
  const previousSelection = useRef('')
  const index = useMemo(() => data ? buildResearchIndex(data) : [], [data])
  const effectiveProject = allProjects ? '' : project
  const results = useMemo(() => searchResearchIndex(index, query, {
    projectId: effectiveProject || undefined, kind: kind || undefined,
  }), [index, query, effectiveProject, kind])
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const selected = index.find((record) => record.key === selectedKey && (!effectiveProject || record.projectId === effectiveProject))
  const related = useMemo(() => data && selected ? getRelatedRecords(data, index, selected) : [], [data, index, selected])
  const relatedPages = Math.max(1, Math.ceil(related.length / PAGE_SIZE))
  const currentRelatedPage = Math.min(relatedPage, relatedPages)
  const resetSelection = () => { setPage(1); setSelectedKey('') }
  const projectTitle = (id: string) => data?.projects.find((item) => item.id === id)?.shortTitle || data?.projects.find((item) => item.id === id)?.title || ''
  const showValue = (label: string, value: string) => ENUM_FIELDS.has(label) && Object.hasOwn(domainLabelKeys, value) ? labelEnum(value as LocalizedDomainValue) : value
  const snippet = (record: (typeof index)[number]) => {
    const terms = query.normalize('NFC').toLowerCase().trim().split(/\s+/u).filter(Boolean)
    const field = record.fields.find((item) => terms.length && terms.some((term) => item.value.normalize('NFC').toLowerCase().includes(term)))
      ?? record.fields.find((item) => ['notes', 'content', 'whyRead', 'finding', 'resultSummary', 'nextStep', 'comment'].includes(item.label))
    if (!field) return ''
    const normalized = field.value.normalize('NFC').toLowerCase()
    const position = terms.map((term) => normalized.indexOf(term)).filter((offset) => offset >= 0).sort((a, b) => a - b)[0] ?? 0
    const start = Math.max(0, position - 45)
    return `${start ? '…' : ''}${field.value.slice(start, start + 180)}${field.value.length > start + 180 ? '…' : ''}`
  }
  useEffect(() => {
    if (selectedKey) detailHeading.current?.focus({ preventScroll: false })
    else if (previousSelection.current) queryInput.current?.focus({ preventScroll: true })
    previousSelection.current = selectedKey
  }, [selectedKey])
  const openRecord = (key: string) => { setRelatedPage(1); setSelectedKey(key) }
  const browse = (projectId: string, recordKind: RecordKind) => {
    setProject(projectId); setAllProjects(false); setKind(recordKind); setQuery(''); resetSelection(); setView('search')
  }

  if (!data) return null
  return <Modal open title={t('navigator.title')} description={t('navigator.description')} onClose={onClose} size="xl" footer={<Button onClick={onClose}>{t('navigator.done')}</Button>}>
    <div className="research-navigator">
      <div className="navigator-switch" role="group" aria-label={t('navigator.title')}>
        <Button aria-pressed={view === 'search'} variant={view === 'search' ? 'primary' : 'secondary'} onClick={() => { setView('search'); setSelectedKey('') }}>{t('navigator.search')}</Button>
        <Button aria-pressed={view === 'overview'} variant={view === 'overview' ? 'primary' : 'secondary'} onClick={() => { setView('overview'); setSelectedKey('') }}>{t('navigator.overview')}</Button>
      </div>
      <p className="navigator-note">{t('navigator.privacy')}</p>
      <div className="navigator-scope">
        <label className="navigator-check"><input type="checkbox" checked={allProjects} onChange={(event) => { setAllProjects(event.target.checked); resetSelection() }} />{t('navigator.allProjects')}</label>
        {!allProjects && <label>{t('navigator.project')}<select aria-label={t('navigator.project')} value={project} onChange={(event) => { setProject(event.target.value); resetSelection() }}>
          <option value="">{t('navigator.all')}</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.shortTitle || item.title}</option>)}
        </select></label>}
      </div>
      {view === 'overview' ? <ProjectResearchOverview data={data} projectId={effectiveProject} onBrowse={browse} /> : <>
        <div className="navigator-controls">
          <label>{t('navigator.query')}<input ref={queryInput} type="search" aria-label={t('navigator.query')} value={query} maxLength={200} placeholder={t('navigator.placeholder')} onChange={(event) => { setQuery(event.target.value); resetSelection() }} /></label>
          <label>{t('navigator.type')}<select aria-label={t('navigator.type')} value={kind || 'all'} onChange={(event) => { setKind(event.target.value === 'all' ? '' : event.target.value as RecordKind); resetSelection() }}>
            <option value="all">{t('navigator.allTypes')}</option>
            {RECORD_KINDS.map((type) => <option key={type} value={type}>{t(`navigator.kind.${type}`)}</option>)}
          </select></label>
        </div>
        {selected ? <section className="navigator-detail" aria-label={t('navigator.details')}>
          <Button size="sm" onClick={() => setSelectedKey('')}>{t('navigator.back')}</Button>
          <p className="navigator-meta">{t(`navigator.kind.${selected.kind}`)} · {projectTitle(selected.projectId)}</p>
          <h3 ref={detailHeading} tabIndex={-1}>{selected.title}</h3>
          <dl>{selected.fields.map((field) => <div key={field.label}><dt>{t(`navigator.field.${field.label}` as MessageKey)}</dt><dd>{showValue(field.label, field.value)}</dd></div>)}</dl>
          <h4>{t('navigator.related')}</h4>
          <p className="navigator-note">{t('navigator.relationshipNote')}</p>
          <p role="status">{t('navigator.relatedCount', { count: formatNumber(related.length), page: formatNumber(currentRelatedPage), pages: formatNumber(relatedPages) })}</p>
          {related.length ? <ul className="navigator-related">{related.slice((currentRelatedPage - 1) * PAGE_SIZE, currentRelatedPage * PAGE_SIZE).map((record) => <li key={record.key}><button type="button" onClick={() => openRecord(record.key)}><span>{t(`navigator.kind.${record.kind}`)}</span>{record.title}</button></li>)}</ul> : <p>{t('navigator.noRelations')}</p>}
          {relatedPages > 1 && <div className="navigator-pagination"><Button disabled={currentRelatedPage === 1} onClick={() => setRelatedPage(currentRelatedPage - 1)}>{t('navigator.previousRelated')}</Button><Button disabled={currentRelatedPage === relatedPages} onClick={() => setRelatedPage(currentRelatedPage + 1)}>{t('navigator.nextRelated')}</Button></div>}
          <Link className="button button--secondary" to={selected.route} onClick={onClose}>{t('navigator.module')}</Link>
          <p className="navigator-note">{t('navigator.moduleNote')}</p>
        </section> : <>
          <p className="navigator-note">{t('navigator.recent')}</p>
          <p role="status">{t('navigator.count', { count: formatNumber(results.length), page: formatNumber(currentPage), pages: formatNumber(pages) })}</p>
          {results.length ? <ul className="navigator-results">{results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((record) => <li key={record.key}>
            <button type="button" onClick={() => openRecord(record.key)}>
              <span className="navigator-meta">{t(`navigator.kind.${record.kind}`)} · {projectTitle(record.projectId)}</span>
              <strong>{record.title}</strong>
              <span className="navigator-snippet">{snippet(record)}</span>
            </button>
          </li>)}</ul> : <p className="navigator-empty">{t('navigator.empty')}</p>}
          {pages > 1 && <div className="navigator-pagination"><Button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t('navigator.previous')}</Button><Button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>{t('navigator.next')}</Button></div>}
        </>}
      </>}
    </div>
  </Modal>
}
