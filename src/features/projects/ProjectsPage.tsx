import { useMemo, useState, type FormEvent } from 'react'
import { FolderKanban, Network } from 'lucide-react'
import {
  PROJECT_STATUSES,
  RESEARCH_METHODS,
  type ResearchProject,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { daysUntil, entityMeta, formatDate, todayIso, truncate } from '../../app/format'
import {
  AddButton,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SearchField,
  SectionHeader,
  StatCard,
  TableActions,
  type Tone,
} from '../../components/ui'

interface ProjectDraft {
  title: string
  shortTitle: string
  researchQuestion: string
  topic: string
  method: ResearchProject['method']
  status: ResearchProject['status']
  startDate: string
  targetDate: string
  notes: string
}

const emptyDraft = (): ProjectDraft => ({
  title: '',
  shortTitle: '',
  researchQuestion: '',
  topic: '',
  method: 'Qualitative',
  status: 'Idea',
  startDate: todayIso(),
  targetDate: '',
  notes: '',
})

const statusTone = (status: ResearchProject['status']): Tone => {
  if (status === 'Published') return 'success'
  if (status === 'Archived') return 'neutral'
  if (status === 'Revision' || status === 'Submission') return 'violet'
  if (status === 'Analysis' || status === 'Writing') return 'accent'
  return 'blue'
}

export function ProjectsPage() {
  const { data, updateData, setActiveProject } = useWorkspace()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [detail, setDetail] = useState<ResearchProject | null>(null)
  const [editing, setEditing] = useState<ResearchProject | null>(null)
  const [deleting, setDeleting] = useState<ResearchProject | null>(null)
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (
      data?.projects.filter((project) => {
        const matchesQuery =
          !query ||
          [project.title, project.shortTitle, project.researchQuestion, project.topic]
            .join(' ')
            .toLowerCase()
            .includes(query)
        return matchesQuery && (!statusFilter || project.status === statusFilter) && (!methodFilter || project.method === methodFilter)
      }) ?? []
    )
  }, [data?.projects, methodFilter, search, statusFilter])

  if (!data) return null

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft())
    setFormOpen(true)
  }

  const openEdit = (project: ResearchProject) => {
    setEditing(project)
    setDraft({
      title: project.title,
      shortTitle: project.shortTitle,
      researchQuestion: project.researchQuestion,
      topic: project.topic,
      method: project.method,
      status: project.status,
      startDate: project.startDate,
      targetDate: project.targetDate || '',
      notes: project.notes,
    })
    setDetail(null)
    setFormOpen(true)
  }

  const saveProject = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedDraft = {
      ...draft,
      title: draft.title.trim(),
      shortTitle: draft.shortTitle.trim() || draft.title.trim().slice(0, 36),
      researchQuestion: draft.researchQuestion.trim(),
      topic: draft.topic.trim(),
      notes: draft.notes.trim(),
    }
    if (editing) {
      await updateData((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === editing.id
            ? { ...project, ...normalizedDraft, targetDate: draft.targetDate || undefined, updatedAt: new Date().toISOString() }
            : project,
        ),
      }))
    } else {
      const record: ResearchProject = {
        ...entityMeta('project'),
        ...normalizedDraft,
        targetDate: draft.targetDate || undefined,
      }
      await updateData((current) => ({ ...current, projects: [record, ...current.projects] }))
    }
    setFormOpen(false)
    setEditing(null)
  }

  const deleteProject = async () => {
    if (!deleting) return
    const id = deleting.id
    const dependencyCount =
      data.tasks.filter((item) => item.projectId === id).length +
      data.literature.filter((item) => item.projectId === id).length +
      data.fieldSites.filter((item) => item.projectId === id).length +
      data.interviews.filter((item) => item.projectId === id).length +
      data.fieldVisits.filter((item) => item.projectId === id).length +
      data.datasets.filter((item) => item.projectId === id).length +
      data.analysisRuns.filter((item) => item.projectId === id).length +
      data.evidence.filter((item) => item.projectId === id).length +
      data.researchLogs.filter((item) => item.projectId === id).length +
      data.manuscripts.filter((item) => item.projectId === id).length +
      data.submissions.filter((item) => item.projectId === id).length
    if (dependencyCount > 0) return
    await updateData((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        activeProjectId: current.workspace.activeProjectId === id ? undefined : current.workspace.activeProjectId,
      },
      projects: current.projects.filter((project) => project.id !== id),
    }))
    setDeleting(null)
    setDetail(null)
  }

  const activeCount = data.projects.filter((project) => !['Published', 'Archived'].includes(project.status)).length
  const inWriting = data.projects.filter((project) => ['Writing', 'Submission', 'Revision'].includes(project.status)).length
  const nearDeadline = data.projects.filter((project) => {
    const days = daysUntil(project.targetDate)
    return days !== null && days >= 0 && days <= 45
  }).length

  const deletingDependencies = deleting
    ? data.tasks.filter((item) => item.projectId === deleting.id).length +
      data.literature.filter((item) => item.projectId === deleting.id).length +
      data.fieldSites.filter((item) => item.projectId === deleting.id).length +
      data.interviews.filter((item) => item.projectId === deleting.id).length +
      data.fieldVisits.filter((item) => item.projectId === deleting.id).length +
      data.datasets.filter((item) => item.projectId === deleting.id).length +
      data.analysisRuns.filter((item) => item.projectId === deleting.id).length +
      data.evidence.filter((item) => item.projectId === deleting.id).length +
      data.researchLogs.filter((item) => item.projectId === deleting.id).length +
      data.manuscripts.filter((item) => item.projectId === deleting.id).length +
      data.submissions.filter((item) => item.projectId === deleting.id).length
    : 0

  const linked = detail
    ? {
        tasks: data.tasks.filter((item) => item.projectId === detail.id),
        literature: data.literature.filter((item) => item.projectId === detail.id),
        fieldwork:
          data.fieldSites.filter((item) => item.projectId === detail.id).length +
          data.interviews.filter((item) => item.projectId === detail.id).length +
          data.fieldVisits.filter((item) => item.projectId === detail.id).length,
        quantitative:
          data.datasets.filter((item) => item.projectId === detail.id).length +
          data.analysisRuns.filter((item) => item.projectId === detail.id).length,
        evidence: data.evidence.filter((item) => item.projectId === detail.id),
        manuscripts: data.manuscripts.filter((item) => item.projectId === detail.id),
        submissions: data.submissions.filter((item) => item.projectId === detail.id),
      }
    : null

  return (
    <div className="page">
      <PageHeader
        index="02"
        eyebrow="Research portfolio"
        title="Projects"
        description="Organize the full arc from research question and design to evidence, writing, and publication."
        actions={<AddButton onClick={openCreate}>New project</AddButton>}
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label="Active projects" value={activeCount} detail="not published or archived" tone="blue" />
        <StatCard label="Writing pipeline" value={inWriting} detail="writing through revision" tone="violet" />
        <StatCard label="Next 45 days" value={nearDeadline} detail="target dates approaching" tone={nearDeadline ? 'warning' : 'neutral'} />
        <StatCard label="Evidence linked" value={data.evidence.length} detail="across the portfolio" tone="accent" />
      </div>

      <section className="panel">
        <div className="toolbar">
          <SearchField value={search} onChange={setSearch} placeholder="Search title, question, or topic" />
          <div className="toolbar__filters">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by project status">
              <option value="">All stages</option>
              {PROJECT_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
            <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} aria-label="Filter by method">
              <option value="">All methods</option>
              {RESEARCH_METHODS.map((method) => <option key={method}>{method}</option>)}
            </select>
          </div>
          <span className="toolbar__count">{filtered.length} of {data.projects.length}</span>
        </div>

        {filtered.length ? (
          <div className="data-table-wrap">
            <table className="data-table projects-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Stage</th>
                  <th>Method</th>
                  <th>Target</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const days = daysUntil(project.targetDate)
                  return (
                    <tr key={project.id}>
                      <td data-label="Project">
                        <button type="button" className="record-title" onClick={() => setDetail(project)}>
                          <strong>{project.title}</strong>
                          <span>{truncate(project.researchQuestion, 94)}</span>
                        </button>
                      </td>
                      <td data-label="Stage"><Badge tone={statusTone(project.status)}>{project.status}</Badge></td>
                      <td data-label="Method"><span className="method-label">{project.method}</span></td>
                      <td data-label="Target">
                        <span className={days !== null && days < 0 ? 'date-cell date-cell--overdue' : 'date-cell'}>
                          {formatDate(project.targetDate)}
                          {days !== null && days >= 0 && days <= 45 && <small>{days}d remaining</small>}
                        </span>
                      </td>
                      <td>
                        <TableActions
                          onView={() => setDetail(project)}
                          onEdit={() => openEdit(project)}
                          onDelete={() => setDeleting(project)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={data.projects.length ? 'No projects match these filters' : 'Start with a research project'}
            description={data.projects.length ? 'Clear a filter or search for a different term.' : 'Define the question, method, and current stage that will organize related work.'}
            action={data.projects.length ? <Button onClick={() => { setSearch(''); setStatusFilter(''); setMethodFilter('') }}>Clear filters</Button> : <AddButton onClick={openCreate}>Create first project</AddButton>}
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title={editing ? 'Edit research project' : 'Create a research project'}
        description="A project is the anchor for tasks, sources, fieldwork, analysis, evidence, and writing."
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" form="project-form" variant="primary">{editing ? 'Save changes' : 'Create project'}</Button>
          </>
        }
      >
        <form id="project-form" className="form-grid" onSubmit={(event) => void saveProject(event)}>
          <Field label="Project title" required className="form-span-2">
            <input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Descriptive working title" />
          </Field>
          <Field label="Short title" hint="Used in dense tables and selectors.">
            <input value={draft.shortTitle} onChange={(event) => setDraft({ ...draft, shortTitle: event.target.value })} placeholder="A concise label" />
          </Field>
          <Field label="Topic" required>
            <input required value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} placeholder="e.g. labor, migration, family" />
          </Field>
          <Field label="Research question" required className="form-span-2">
            <textarea required rows={3} value={draft.researchQuestion} onChange={(event) => setDraft({ ...draft, researchQuestion: event.target.value })} placeholder="State the empirical or theoretical question this project must answer." />
          </Field>
          <Field label="Method" required>
            <select value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value as ResearchProject['method'] })}>
              {RESEARCH_METHODS.map((method) => <option key={method}>{method}</option>)}
            </select>
          </Field>
          <Field label="Current stage" required>
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ResearchProject['status'] })}>
              {PROJECT_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="Start date" required>
            <input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
          </Field>
          <Field label="Target date">
            <input type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} />
          </Field>
          <Field label="Project notes" className="form-span-2">
            <textarea rows={4} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Design constraints, collaborators, scope boundaries, or current uncertainty" />
          </Field>
        </form>
      </Modal>

      {detail && linked && (
        <Modal
          open
          title={detail.title}
          description={detail.researchQuestion}
          onClose={() => setDetail(null)}
          size="xl"
          footer={
            <>
              <Button onClick={() => void setActiveProject(detail.id)}>Make primary project</Button>
              <Button variant="primary" onClick={() => openEdit(detail)}>Edit project</Button>
            </>
          }
        >
          <div className="project-detail">
            <aside className="project-detail__summary">
              <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
              <dl>
                <div><dt>Method</dt><dd>{detail.method}</dd></div>
                <div><dt>Topic</dt><dd>{detail.topic}</dd></div>
                <div><dt>Started</dt><dd>{formatDate(detail.startDate)}</dd></div>
                <div><dt>Target</dt><dd>{formatDate(detail.targetDate)}</dd></div>
              </dl>
              {detail.notes && <p>{detail.notes}</p>}
            </aside>
            <div className="project-detail__workspace">
              <div className="linked-object-grid">
                {[
                  ['Current tasks', linked.tasks.filter((item) => item.status !== 'Done').length],
                  ['Literature', linked.literature.length],
                  ['Data / fieldwork', linked.fieldwork + linked.quantitative],
                  ['Evidence', linked.evidence.length],
                  ['Manuscripts', linked.manuscripts.length],
                  ['Submissions', linked.submissions.length],
                ].map(([label, count]) => (
                  <div key={label}><span>{label}</span><strong>{count}</strong></div>
                ))}
              </div>
              <section>
                <SectionHeader title="Current tasks" description="Open work explicitly linked to this project." />
                {linked.tasks.filter((item) => item.status !== 'Done').length ? (
                  <div className="compact-record-list">
                    {linked.tasks.filter((item) => item.status !== 'Done').slice(0, 5).map((item) => (
                      <article key={item.id}>
                        <span className="object-mark"><FolderKanban size={14} /></span>
                        <div><strong>{item.title}</strong><span>{item.category} · {formatDate(item.dueDate)}</span></div>
                        <Badge tone={item.priority === 'Critical' ? 'danger' : 'neutral'}>{item.status}</Badge>
                      </article>
                    ))}
                  </div>
                ) : <p className="quiet-copy">No open tasks linked to this project.</p>}
              </section>
              <section>
                <SectionHeader title="Evidence pulse" description="Recent claims and the strength of their support." />
                {linked.evidence.length ? (
                  <div className="compact-record-list">
                    {linked.evidence.slice(0, 4).map((item) => (
                      <article key={item.id}>
                        <span className="object-mark"><Network size={14} /></span>
                        <div><strong>{truncate(item.claim, 90)}</strong><span>{item.evidenceType} · {item.source}</span></div>
                        <Badge tone={item.supportLevel === 'Strong' ? 'success' : item.supportLevel === 'Contradictory' ? 'danger' : 'warning'}>{item.supportLevel}</Badge>
                      </article>
                    ))}
                  </div>
                ) : <p className="quiet-copy">No evidence claims linked yet.</p>}
              </section>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(deleting) && deletingDependencies === 0}
        title={`Delete “${deleting?.shortTitle || deleting?.title || 'project'}”?`}
        description="This empty project record will be permanently removed from the local workspace."
        confirmLabel="Delete project"
        onCancel={() => setDeleting(null)}
        onConfirm={deleteProject}
      />
      <Modal
        open={Boolean(deleting) && deletingDependencies > 0}
        title="Project still has linked research records"
        description="Sociology PhD Desk will not silently cascade-delete research material or leave broken provenance links."
        onClose={() => setDeleting(null)}
        size="sm"
        footer={<Button variant="primary" onClick={() => setDeleting(null)}>Keep project</Button>}
      >
        <div className="confirm-panel confirm-panel--primary">
          <Network size={20} />
          <p>
            {deletingDependencies} linked {deletingDependencies === 1 ? 'record must' : 'records must'} be moved or deleted before this project can be removed.
          </p>
        </div>
      </Modal>
    </div>
  )
}
