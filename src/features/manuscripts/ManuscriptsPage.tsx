import { useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, FilePenLine } from 'lucide-react'
import {
  MANUSCRIPT_STATUSES,
  type Manuscript,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import {
  entityMeta,
  formatDate,
  projectLabel,
  todayIso,
  truncate,
} from '../../app/format'
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
  SectionHeader,
  StatCard,
  type Tone,
} from '../../components/ui'

interface ManuscriptDraft {
  title: string
  projectId: string
  targetJournal: string
  status: Manuscript['status']
  wordCount: string
  nextAction: string
  deadline: string
}

interface PipelineStage {
  label: string
  description: string
  statuses: Manuscript['status'][]
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    label: 'Develop',
    description: 'From argument idea to a complete draft.',
    statuses: ['Idea', 'Outline', 'Drafting'],
  },
  {
    label: 'Internal review',
    description: 'Sharpen claims before the external record begins.',
    statuses: ['Internal Review', 'Ready to Submit'],
  },
  {
    label: 'External cycle',
    description: 'Submission, review, and revision work.',
    statuses: ['Submitted', 'Under Review', 'Revision'],
  },
  {
    label: 'Outcome / rework',
    description: 'Publication outcomes and deliberate re-framing.',
    statuses: ['Accepted', 'Published', 'Rejected', 'Reworking'],
  },
]

const emptyDraft = (projectId = ''): ManuscriptDraft => ({
  title: '',
  projectId,
  targetJournal: '',
  status: 'Idea',
  wordCount: '0',
  nextAction: '',
  deadline: '',
})

const statusTone = (status: Manuscript['status']): Tone => {
  if (status === 'Accepted' || status === 'Published') return 'success'
  if (status === 'Rejected') return 'danger'
  if (status === 'Revision' || status === 'Reworking') return 'warning'
  if (status === 'Submitted' || status === 'Under Review') return 'violet'
  if (status === 'Drafting' || status === 'Internal Review') return 'accent'
  if (status === 'Ready to Submit') return 'blue'
  return 'neutral'
}

const isClosed = (status: Manuscript['status']) =>
  status === 'Accepted' || status === 'Published' || status === 'Rejected'

export function ManuscriptsPage() {
  const { data, updateData } = useWorkspace()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<ManuscriptDraft>(emptyDraft)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const projects = data?.projects ?? []
    return (data?.manuscripts ?? [])
      .filter((manuscript) => {
        const corpus = [
          manuscript.title,
          manuscript.targetJournal,
          manuscript.nextAction,
          manuscript.status,
          projectLabel(projects, manuscript.projectId),
        ]
          .join(' ')
          .toLowerCase()
        return (
          (!query || corpus.includes(query)) &&
          (!projectFilter || manuscript.projectId === projectFilter) &&
          (!statusFilter || manuscript.status === statusFilter)
        )
      })
      .sort((left, right) =>
        (left.deadline || '9999-12-31').localeCompare(right.deadline || '9999-12-31') ||
        right.updatedAt.localeCompare(left.updatedAt),
      )
  }, [data?.manuscripts, data?.projects, projectFilter, search, statusFilter])

  if (!data) return null

  const openCreate = () => {
    if (!data.projects.length) return
    const preferredProject = data.projects.some(
      (project) => project.id === data.workspace.activeProjectId,
    )
      ? data.workspace.activeProjectId
      : data.projects[0]?.id
    setDraft(emptyDraft(preferredProject || ''))
    setFormOpen(true)
  }

  const saveManuscript = async (event: FormEvent) => {
    event.preventDefault()
    if (!data.projects.some((project) => project.id === draft.projectId)) return
    if (!draft.targetJournal.trim()) return
    const parsedWordCount = Number(draft.wordCount)
    if (!Number.isFinite(parsedWordCount) || parsedWordCount < 0) return

    const record: Manuscript = {
      ...entityMeta('manuscript'),
      title: draft.title.trim(),
      projectId: draft.projectId,
      targetJournal: draft.targetJournal.trim(),
      status: draft.status,
      wordCount: Math.round(parsedWordCount),
      nextAction: draft.nextAction.trim(),
      deadline: draft.deadline || undefined,
    }
    await updateData((current) => ({
      ...current,
      manuscripts: [record, ...current.manuscripts],
    }))
    setFormOpen(false)
  }

  const updateStatus = async (id: string, status: Manuscript['status']) => {
    await updateData((current) => ({
      ...current,
      manuscripts: current.manuscripts.map((manuscript) =>
        manuscript.id === id
          ? { ...manuscript, status, updatedAt: new Date().toISOString() }
          : manuscript,
      ),
    }))
  }

  const developing = data.manuscripts.filter((manuscript) =>
    PIPELINE_STAGES[0].statuses.includes(manuscript.status),
  ).length
  const external = data.manuscripts.filter((manuscript) =>
    PIPELINE_STAGES[2].statuses.includes(manuscript.status),
  ).length
  const accepted = data.manuscripts.filter((manuscript) =>
    manuscript.status === 'Accepted' || manuscript.status === 'Published',
  ).length
  const datedMilestones = data.manuscripts.filter(
    (manuscript) => manuscript.deadline && !isClosed(manuscript.status),
  ).length

  return (
    <div className="page">
      <PageHeader
        index="08"
        eyebrow="Writing pipeline"
        title="Manuscripts"
        description="Move arguments from outline to publication while keeping the next consequential writing action visible."
        actions={
          <AddButton
            onClick={openCreate}
            disabled={!data.projects.length}
            title={!data.projects.length ? 'Create a project before adding a manuscript.' : undefined}
          >
            Add manuscript
          </AddButton>
        }
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label="Developing" value={developing} detail="idea through drafting" tone="accent" />
        <StatCard label="External cycle" value={external} detail="submitted through revision" tone="violet" />
        <StatCard label="Accepted / published" value={accepted} detail={`${data.manuscripts.length} manuscripts total`} tone="success" />
        <StatCard label="Dated milestones" value={datedMilestones} detail="open deadline commitments" tone={datedMilestones ? 'warning' : 'neutral'} />
      </div>

      <section className="panel">
        <SectionHeader
          title="Argument pipeline"
          description="Status expresses editorial position; the next action expresses the work needed now."
        />
        <div className="toolbar toolbar--wrap">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search title, journal, project, or next action"
          />
          <ProjectSelect
            projects={data.projects}
            value={projectFilter}
            onChange={setProjectFilter}
            includeAll
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by manuscript status"
          >
            <option value="">All statuses</option>
            {MANUSCRIPT_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
          <span className="toolbar__count">{filtered.length} manuscripts</span>
        </div>

        {filtered.length ? (
          <div className="manuscript-pipeline">
            {PIPELINE_STAGES.map((stage) => {
              const manuscripts = filtered.filter((manuscript) =>
                stage.statuses.includes(manuscript.status),
              )
              return (
                <section className="pipeline-lane" key={stage.label}>
                  <header className="pipeline-lane__header">
                    <div>
                      <p className="eyebrow">Pipeline stage</p>
                      <h2>{stage.label}</h2>
                      <p>{stage.description}</p>
                    </div>
                    <Badge>{manuscripts.length}</Badge>
                  </header>
                  <div className="pipeline-lane__records">
                    {manuscripts.length ? manuscripts.map((manuscript) => {
                      const overdue = Boolean(
                        manuscript.deadline &&
                        manuscript.deadline < todayIso() &&
                        !isClosed(manuscript.status),
                      )
                      return (
                        <article className="manuscript-card" key={manuscript.id}>
                          <header>
                            <span className="object-mark"><FilePenLine size={16} /></span>
                            <Badge tone={statusTone(manuscript.status)}>{manuscript.status}</Badge>
                          </header>
                          <h3>{manuscript.title}</h3>
                          <p className="manuscript-card__journal">
                            {manuscript.targetJournal || 'Target journal not set'}
                          </p>
                          <dl>
                            <div><dt>Project</dt><dd>{projectLabel(data.projects, manuscript.projectId)}</dd></div>
                            <div><dt>Word count</dt><dd>{new Intl.NumberFormat('en').format(manuscript.wordCount)}</dd></div>
                            <div>
                              <dt>Deadline</dt>
                              <dd className={overdue ? 'text-danger' : ''}>
                                <CalendarClock size={13} /> {formatDate(manuscript.deadline)}
                              </dd>
                            </div>
                          </dl>
                          <div className="manuscript-card__next">
                            <span>Next action</span>
                            <p>{truncate(manuscript.nextAction || 'No next action recorded.', 150)}</p>
                          </div>
                          <Field label="Update status" className="field--compact">
                            <select
                              value={manuscript.status}
                              onChange={(event) => void updateStatus(
                                manuscript.id,
                                event.target.value as Manuscript['status'],
                              )}
                              aria-label={`Update status for ${manuscript.title}`}
                            >
                              {MANUSCRIPT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                            </select>
                          </Field>
                        </article>
                      )
                    }) : (
                      <p className="pipeline-lane__empty">No matching manuscripts at this stage.</p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title={data.manuscripts.length ? 'No manuscripts match these filters' : 'No manuscripts in the pipeline'}
            description={
              data.manuscripts.length
                ? 'Clear one or more filters to restore the complete writing pipeline.'
                : data.projects.length
                  ? 'Add an argument, its project, current writing state, and next action.'
                  : 'Create a project first so each manuscript has a real research anchor.'
            }
            action={
              data.manuscripts.length ? (
                <Button onClick={() => { setSearch(''); setProjectFilter(''); setStatusFilter('') }}>Clear filters</Button>
              ) : (
                <AddButton onClick={openCreate} disabled={!data.projects.length}>Add first manuscript</AddButton>
              )
            }
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title="Add a manuscript"
        description="Create a project-linked writing record with one explicit next action."
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="manuscript-form">Add manuscript</Button>
          </>
        }
      >
        <form id="manuscript-form" className="form-grid" onSubmit={(event) => void saveManuscript(event)}>
          <Field label="Working title" required className="form-span-2">
            <input
              autoFocus
              required
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Name the argument rather than the file."
            />
          </Field>
          <Field label="Project" required>
            <ProjectSelect
              required
              projects={data.projects}
              value={draft.projectId}
              onChange={(projectId) => setDraft({ ...draft, projectId })}
            />
          </Field>
          <Field label="Target journal" required>
            <input
              required
              value={draft.targetJournal}
              onChange={(event) => setDraft({ ...draft, targetJournal: event.target.value })}
              placeholder="Use a working journal target; revise it as strategy changes."
            />
          </Field>
          <Field label="Pipeline status" required>
            <select
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value as Manuscript['status'] })}
            >
              {MANUSCRIPT_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="Word count" required>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={draft.wordCount}
              onChange={(event) => setDraft({ ...draft, wordCount: event.target.value })}
            />
          </Field>
          <Field label="Next action" required className="form-span-2">
            <textarea
              required
              rows={3}
              value={draft.nextAction}
              onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })}
              placeholder="e.g. Reconcile the mechanism claim with the robustness appendix."
            />
          </Field>
          <Field label="Deadline" className="form-span-2">
            <input
              type="date"
              value={draft.deadline}
              onChange={(event) => setDraft({ ...draft, deadline: event.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
