import { useMemo, useState, type FormEvent } from 'react'
import { ArrowUpRight, LibraryBig } from 'lucide-react'
import {
  LITERATURE_STATUSES,
  PRIORITIES,
  type LiteratureItem,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { entityMeta, projectLabel, truncate } from '../../app/format'
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

export function LiteraturePage() {
  const { data, updateData } = useWorkspace()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<LiteratureDraft>(emptyDraft)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (
      data?.literature.filter((item) => {
        const corpus = `${item.title} ${item.authors.join(' ')} ${item.journal || ''} ${item.whyRead} ${item.notes}`.toLowerCase()
        return (
          (!query || corpus.includes(query)) &&
          (!projectFilter || item.projectId === projectFilter) &&
          (!statusFilter || item.status === statusFilter) &&
          (!priorityFilter || item.priority === priorityFilter)
        )
      }) ?? []
    )
  }, [data?.literature, priorityFilter, projectFilter, search, statusFilter])

  if (!data) return null

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
        eyebrow="Reading decisions"
        title="Literature inbox"
        description="Track why a source matters, which project question it bears on, and whether it has entered the argument."
        actions={<AddButton onClick={openCreate}>Add literature</AddButton>}
      />

      <section className="boundary-note">
        <LibraryBig size={18} />
        <div><strong>Designed to complement Zotero</strong><p>Zotero remains the reference library. This desk records reading purpose, analytical judgment, project relevance, and argument use.</p></div>
      </section>

      <div className="stats-grid stats-grid--four">
        <StatCard label="Reading backlog" value={backlog} detail="inbox and to read" tone="warning" />
        <StatCard label="Reading now" value={reading} detail="active interpretation" tone="accent" />
        <StatCard label="Cited" value={cited} detail="entered an argument" tone="success" />
        <StatCard label="High priority" value={highPriority} detail="open priority sources" tone="danger" />
      </div>

      <section className="panel">
        <div className="toolbar toolbar--wrap">
          <SearchField value={search} onChange={setSearch} placeholder="Search title, author, journal, or rationale" />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={setProjectFilter} includeAll />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by reading status"><option value="">All statuses</option>{LITERATURE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter by priority"><option value="">All priorities</option>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select>
          <span className="toolbar__count">{filtered.length} sources</span>
        </div>

        {filtered.length ? (
          <div className="literature-list">
            {filtered.map((item) => (
              <article className="literature-row" key={item.id}>
                <div className="literature-row__year"><span>{item.year || 'n.d.'}</span></div>
                <div className="literature-row__main">
                  <div className="badge-row">
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                    <Badge tone={item.priority === 'Critical' ? 'danger' : item.priority === 'High' ? 'warning' : 'neutral'}>{item.priority}</Badge>
                    <span>{projectLabel(data.projects, item.projectId)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="literature-row__citation">{item.authors.join(', ') || 'Unknown author'}{item.journal ? ` · ${item.journal}` : ''}</p>
                  <div className="literature-row__why"><span>Why read</span><p>{truncate(item.whyRead || 'No rationale recorded.', 180)}</p></div>
                </div>
                <div className="literature-row__controls">
                  {(item.url || item.doi) && (
                    <a href={item.url || `https://doi.org/${item.doi}`} target="_blank" rel="noreferrer" aria-label={`Open source for ${item.title}`}><ArrowUpRight size={15} /></a>
                  )}
                  <select value={item.status} onChange={(event) => void updateStatus(item.id, event.target.value as LiteratureItem['status'])} aria-label={`Update status for ${item.title}`}>
                    {LITERATURE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={data.literature.length ? 'No sources match these filters' : 'Your literature queue is empty'}
            description={data.literature.length ? 'Clear one or more filters to recover the reading queue.' : 'Add a source when you can state why it matters to a specific project.'}
            action={data.literature.length ? <Button onClick={() => { setSearch(''); setProjectFilter(''); setStatusFilter(''); setPriorityFilter('') }}>Clear filters</Button> : <AddButton onClick={openCreate}>Add first source</AddButton>}
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title="Add literature"
        description="Capture workflow context here; keep canonical citation management in your reference manager."
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={<><Button onClick={() => setFormOpen(false)}>Cancel</Button><Button variant="primary" type="submit" form="literature-form">Add to queue</Button></>}
      >
        <form id="literature-form" className="form-grid" onSubmit={(event) => void saveLiterature(event)}>
          <Field label="Title" required className="form-span-2"><input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
          <Field label="Authors" required className="form-span-2" hint="Separate names with semicolons."><input required value={draft.authors} onChange={(event) => setDraft({ ...draft, authors: event.target.value })} placeholder="Author One; Author Two" /></Field>
          <Field label="Year"><input type="number" min="1000" max="2100" value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} /></Field>
          <Field label="Journal"><input value={draft.journal} onChange={(event) => setDraft({ ...draft, journal: event.target.value })} /></Field>
          <Field label="DOI"><input value={draft.doi} onChange={(event) => setDraft({ ...draft, doi: event.target.value })} placeholder="10.xxxx/…" /></Field>
          <Field label="URL"><input type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></Field>
          <Field label="Project" required><ProjectSelect required projects={data.projects} value={draft.projectId} onChange={(projectId) => setDraft({ ...draft, projectId })} /></Field>
          <Field label="Reading status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LiteratureItem['status'] })}>{LITERATURE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Priority"><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as LiteratureItem['priority'] })}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></Field>
          <Field label="Why read?" required><textarea required rows={4} value={draft.whyRead} onChange={(event) => setDraft({ ...draft, whyRead: event.target.value })} placeholder="Which question, uncertainty, or debate makes this source worth reading?" /></Field>
          <Field label="Notes" className="form-span-2"><textarea rows={4} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Initial theoretical or empirical judgment" /></Field>
        </form>
      </Modal>
    </div>
  )
}
