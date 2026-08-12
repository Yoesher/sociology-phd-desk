import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowUpRight, LibraryBig } from 'lucide-react'
import {
  LITERATURE_STATUSES,
  PRIORITIES,
  type LiteratureItem,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useI18n } from '../../i18n'
import { entityMeta, truncate } from '../../app/format'
import { QUICK_ADD_EVENT, type QuickAddEvent } from '../../app/navigationEvents'
import { ProjectSelect } from '../../components/ProjectSelect'
import {
  AddButton,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SearchField,
  StatCard,
  type Tone,
} from '../../components/ui'

interface LiteratureDraft {
  title: string
  authors: string
  year: string
  journal: string
  doi: string
  url: string
  projectId: string
  status: LiteratureItem['status']
  priority: LiteratureItem['priority']
  whyRead: string
  notes: string
}

const emptyDraft = (): LiteratureDraft => ({
  title: '',
  authors: '',
  year: '',
  journal: '',
  doi: '',
  url: '',
  projectId: '',
  status: 'Inbox',
  priority: 'Medium',
  whyRead: '',
  notes: '',
})

const statusTone = (status: LiteratureItem['status']): Tone => {
  if (status === 'Cited') return 'success'
  if (status === 'Reading') return 'accent'
  if (status === 'Read') return 'blue'
  if (status === 'Archived') return 'neutral'
  return 'warning'
}

const LITERATURE_VIEW_STATUS = {
  inbox: 'Inbox',
  'to-read': 'To Read',
  reading: 'Reading',
  read: 'Read',
  cited: 'Cited',
  archived: 'Archived',
} as const satisfies Record<string, LiteratureItem['status']>

function readLiteratureView(): 'all' | keyof typeof LITERATURE_VIEW_STATUS {
  const requested = new URLSearchParams(window.location.hash.split('?')[1] || '').get('view')
  return requested && requested in LITERATURE_VIEW_STATUS
    ? requested as keyof typeof LITERATURE_VIEW_STATUS
    : 'all'
}

export function LiteraturePage() {
  const { data, updateData } = useWorkspace()
  const { t, formatNumber, labelEnum } = useI18n()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<LiteratureDraft>(emptyDraft)
  const [view, setView] = useState<'all' | keyof typeof LITERATURE_VIEW_STATUS>(readLiteratureView)

  useEffect(() => {
    const syncView = () => setView(readLiteratureView())
    window.addEventListener('hashchange', syncView)
    window.addEventListener('popstate', syncView)
    return () => {
      window.removeEventListener('hashchange', syncView)
      window.removeEventListener('popstate', syncView)
    }
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (
      data?.literature.filter((item) => {
        const corpus = `${item.title} ${item.authors.join(' ')} ${item.journal || ''} ${item.whyRead} ${item.notes}`.toLowerCase()
        return (
          (!query || corpus.includes(query)) &&
          (view === 'all' || item.status === LITERATURE_VIEW_STATUS[view]) &&
          (!projectFilter || item.projectId === projectFilter) &&
          (!statusFilter || item.status === statusFilter) &&
          (!priorityFilter || item.priority === priorityFilter)
        )
      }) ?? []
    )
  }, [data?.literature, priorityFilter, projectFilter, search, statusFilter, view])

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as QuickAddEvent).detail
      if (detail?.module !== 'literature' || detail.action !== 'literature') return
      setDraft({ ...emptyDraft(), projectId: data?.workspace.activeProjectId || data?.projects[0]?.id || '' })
      setFormOpen(true)
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  }, [data?.projects, data?.workspace.activeProjectId])

  if (!data) return null

  const localizedProjectLabel = (projectId?: string) => {
    const project = data.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }

  const openCreate = () => {
    setDraft({ ...emptyDraft(), projectId: data.workspace.activeProjectId || data.projects[0]?.id || '' })
    setFormOpen(true)
  }

  const saveLiterature = async (event: FormEvent) => {
    event.preventDefault()
    const record: LiteratureItem = {
      ...entityMeta('literature'),
      title: draft.title.trim(),
      authors: draft.authors.split(/[;,\n]/).map((author) => author.trim()).filter(Boolean),
      year: draft.year ? Number(draft.year) : undefined,
      journal: draft.journal.trim() || undefined,
      doi: draft.doi.trim() || undefined,
      url: draft.url.trim() || undefined,
      projectId: draft.projectId,
      status: draft.status,
      priority: draft.priority,
      whyRead: draft.whyRead,
      notes: draft.notes,
    }
    await updateData((current) => ({ ...current, literature: [record, ...current.literature] }))
    setFormOpen(false)
  }

  const updateStatus = async (id: string, status: LiteratureItem['status']) => {
    await updateData((current) => ({
      ...current,
      literature: current.literature.map((item) =>
        item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
      ),
    }))
  }

  const backlog = data.literature.filter((item) => ['Inbox', 'To Read'].includes(item.status)).length
  const reading = data.literature.filter((item) => item.status === 'Reading').length
  const cited = data.literature.filter((item) => item.status === 'Cited').length
  const highPriority = data.literature.filter((item) => ['High', 'Critical'].includes(item.priority) && !['Cited', 'Archived'].includes(item.status)).length

  return (
    <div className="page">
      <PageHeader
        index="03"
        eyebrow={t('literature.header.eyebrow')}
        title={t('literature.header.title')}
        description={t('literature.header.description')}
        actions={<AddButton onClick={openCreate}>{t('literature.actions.add')}</AddButton>}
      />

      <section className="boundary-note">
        <LibraryBig size={18} />
        <div><strong>{t('literature.boundary.title')}</strong><p>{t('literature.boundary.description')}</p></div>
      </section>

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('literature.stats.backlog')} value={formatNumber(backlog)} detail={t('literature.stats.backlogDetail')} tone="warning" />
        <StatCard label={t('literature.stats.reading')} value={formatNumber(reading)} detail={t('literature.stats.readingDetail')} tone="accent" />
        <StatCard label={t('literature.stats.cited')} value={formatNumber(cited)} detail={t('literature.stats.citedDetail')} tone="success" />
        <StatCard label={t('literature.stats.priority')} value={formatNumber(highPriority)} detail={t('literature.stats.priorityDetail')} tone="danger" />
      </div>

      <section className="panel">
        <div className="toolbar toolbar--wrap">
          <SearchField value={search} onChange={setSearch} placeholder={t('literature.filters.search')} />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={setProjectFilter} includeAll />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t('literature.filters.statusAria')}><option value="">{t('literature.filters.allStatuses')}</option>{LITERATURE_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label={t('literature.filters.priorityAria')}><option value="">{t('literature.filters.allPriorities')}</option>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{labelEnum(priority)}</option>)}</select>
          <span className="toolbar__count">{t(filtered.length === 1 ? 'literature.filters.sourceOne' : 'literature.filters.sourceMany', { count: formatNumber(filtered.length) })}</span>
        </div>

        {filtered.length ? (
          <div className="literature-list">
            {filtered.map((item) => (
              <article className="literature-row" key={item.id}>
                <div className="literature-row__year"><span>{item.year || t('literature.item.noDate')}</span></div>
                <div className="literature-row__main">
                  <div className="badge-row">
                    <Badge tone={statusTone(item.status)}>{labelEnum(item.status)}</Badge>
                    <Badge tone={item.priority === 'Critical' ? 'danger' : item.priority === 'High' ? 'warning' : 'neutral'}>{labelEnum(item.priority)}</Badge>
                    <span>{localizedProjectLabel(item.projectId)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="literature-row__citation">{item.authors.join(', ') || t('literature.item.unknownAuthor')}{item.journal ? ` · ${item.journal}` : ''}</p>
                  <div className="literature-row__why"><span>{t('literature.item.whyRead')}</span><p>{truncate(item.whyRead || t('literature.item.noRationale'), 180)}</p></div>
                </div>
                <div className="literature-row__controls">
                  {(item.url || item.doi) && (
                    <a href={item.url || `https://doi.org/${item.doi}`} target="_blank" rel="noreferrer" aria-label={t('literature.item.openSourceAria', { title: item.title })}><ArrowUpRight size={15} /></a>
                  )}
                  <select value={item.status} onChange={(event) => void updateStatus(item.id, event.target.value as LiteratureItem['status'])} aria-label={t('literature.item.updateStatusAria', { title: item.title })}>
                    {LITERATURE_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
                  </select>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={data.literature.length ? t('literature.empty.filteredTitle') : t('literature.empty.initialTitle')}
            description={data.literature.length ? t('literature.empty.filteredDescription') : t('literature.empty.initialDescription')}
            action={data.literature.length ? <Button onClick={() => { setSearch(''); setProjectFilter(''); setStatusFilter(''); setPriorityFilter('') }}>{t('literature.actions.clearFilters')}</Button> : <AddButton onClick={openCreate}>{t('literature.actions.addFirst')}</AddButton>}
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title={t('literature.form.title')}
        description={t('literature.form.description')}
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={<><Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button><Button variant="primary" type="submit" form="literature-form">{t('literature.form.submit')}</Button></>}
      >
        <form id="literature-form" className="form-grid" onSubmit={(event) => void saveLiterature(event)}>
          <Field label={t('literature.form.sourceTitle')} required className="form-span-2"><input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
          <Field label={t('literature.form.authors')} required className="form-span-2" hint={t('literature.form.authorsHint')}><input required value={draft.authors} onChange={(event) => setDraft({ ...draft, authors: event.target.value })} placeholder={t('literature.form.authorsPlaceholder')} /></Field>
          <Field label={t('literature.form.year')}><input type="number" min="1000" max="2100" value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} /></Field>
          <Field label={t('literature.form.journal')}><input value={draft.journal} onChange={(event) => setDraft({ ...draft, journal: event.target.value })} /></Field>
          <Field label={t('literature.form.doi')}><input value={draft.doi} onChange={(event) => setDraft({ ...draft, doi: event.target.value })} placeholder={t('literature.form.doiPlaceholder')} /></Field>
          <Field label={t('literature.form.url')}><input type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></Field>
          <Field label={t('literature.form.project')} required><ProjectSelect required projects={data.projects} value={draft.projectId} onChange={(projectId) => setDraft({ ...draft, projectId })} /></Field>
          <Field label={t('literature.form.status')}><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LiteratureItem['status'] })}>{LITERATURE_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('literature.form.priority')}><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as LiteratureItem['priority'] })}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{labelEnum(priority)}</option>)}</select></Field>
          <Field label={t('literature.form.whyRead')} required><textarea required rows={4} value={draft.whyRead} onChange={(event) => setDraft({ ...draft, whyRead: event.target.value })} placeholder={t('literature.form.whyReadPlaceholder')} /></Field>
          <Field label={t('literature.form.notes')} className="form-span-2"><textarea rows={4} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder={t('literature.form.notesPlaceholder')} /></Field>
        </form>
      </Modal>
    </div>
  )
}
