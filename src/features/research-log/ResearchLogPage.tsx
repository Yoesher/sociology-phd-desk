import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, ScrollText } from 'lucide-react'
import type { ResearchLogEntry } from '../../models/domain'
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
  StatCard,
} from '../../components/ui'

interface ResearchLogDraft {
  date: string
  projectId: string
  whatChanged: string
  decision: string
  problem: string
  nextStep: string
}

const emptyDraft = (projectId = ''): ResearchLogDraft => ({
  date: todayIso(),
  projectId,
  whatChanged: '',
  decision: '',
  problem: '',
  nextStep: '',
})

export function ResearchLogPage() {
  const { data, updateData } = useWorkspace()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<ResearchLogDraft>(emptyDraft)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const projects = data?.projects ?? []
    return (data?.researchLogs ?? [])
      .filter((entry) => {
        const corpus = [
          entry.whatChanged,
          entry.decision,
          entry.problem,
          entry.nextStep,
          projectLabel(projects, entry.projectId),
        ]
          .join(' ')
          .toLowerCase()
        return (
          (!query || corpus.includes(query)) &&
          (!projectFilter || entry.projectId === projectFilter)
        )
      })
      .sort((left, right) =>
        right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt),
      )
  }, [data?.projects, data?.researchLogs, projectFilter, search])

  const timeline = useMemo(() => {
    const groups: Array<{ date: string; entries: ResearchLogEntry[] }> = []
    filtered.forEach((entry) => {
      const current = groups.at(-1)
      if (current?.date === entry.date) current.entries.push(entry)
      else groups.push({ date: entry.date, entries: [entry] })
    })
    return groups
  }, [filtered])

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

  const saveEntry = async (event: FormEvent) => {
    event.preventDefault()
    if (!data.projects.some((project) => project.id === draft.projectId)) return

    const record: ResearchLogEntry = {
      ...entityMeta('log'),
      date: draft.date,
      projectId: draft.projectId,
      whatChanged: draft.whatChanged.trim(),
      decision: draft.decision.trim(),
      problem: draft.problem.trim(),
      nextStep: draft.nextStep.trim(),
    }
    await updateData((current) => ({
      ...current,
      researchLogs: [record, ...current.researchLogs],
    }))
    setFormOpen(false)
  }

  const monthPrefix = todayIso().slice(0, 7)
  const thisMonth = data.researchLogs.filter((entry) => entry.date.startsWith(monthPrefix)).length
  const decisions = data.researchLogs.filter((entry) => entry.decision.trim()).length
  const problems = data.researchLogs.filter((entry) => entry.problem.trim()).length

  return (
    <div className="page">
      <PageHeader
        index="07"
        eyebrow="Decision audit trail"
        title="Research log"
        description="Recover what changed, why a decision was made, which uncertainty remains, and what should happen next."
        actions={
          <AddButton
            onClick={openCreate}
            disabled={!data.projects.length}
            title={!data.projects.length ? 'Create a project before adding a log entry.' : undefined}
          >
            Add log entry
          </AddButton>
        }
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label="Log entries" value={data.researchLogs.length} detail="recoverable research moves" tone="blue" />
        <StatCard label="This month" value={thisMonth} detail="changes and judgments" tone="accent" />
        <StatCard label="Decisions" value={decisions} detail="with recorded rationale" tone="success" />
        <StatCard label="Problems noted" value={problems} detail="uncertainties retained" tone={problems ? 'warning' : 'neutral'} />
      </div>

      <section className="panel">
        <div className="toolbar toolbar--wrap">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search changes, decisions, problems, or next steps"
          />
          <ProjectSelect
            projects={data.projects}
            value={projectFilter}
            onChange={setProjectFilter}
            includeAll
          />
          <span className="toolbar__count">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {timeline.length ? (
          <div className="research-log-timeline">
            {timeline.map((group) => (
              <section className="research-log-day" key={group.date}>
                <header className="research-log-day__header">
                  <span className="object-mark"><CalendarDays size={16} /></span>
                  <div>
                    <p className="eyebrow">Research date</p>
                    <h2>{formatDate(group.date)}</h2>
                  </div>
                  <Badge>{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</Badge>
                </header>
                <div className="research-log-day__entries">
                  {group.entries.map((entry) => (
                    <article className="research-log-entry" key={entry.id}>
                      <span className="research-log-entry__mark" aria-hidden="true">
                        <ScrollText size={15} />
                      </span>
                      <div className="research-log-entry__body">
                        <div className="badge-row">
                          <Badge tone="blue">{projectLabel(data.projects, entry.projectId)}</Badge>
                          {entry.decision && <Badge tone="success">Decision recorded</Badge>}
                          {entry.problem && <Badge tone="warning">Problem retained</Badge>}
                        </div>
                        <h3>{entry.whatChanged}</h3>
                        <dl className="research-log-entry__details">
                          <div>
                            <dt>Decision / rationale</dt>
                            <dd>{entry.decision || 'No decision recorded.'}</dd>
                          </div>
                          <div>
                            <dt>Problem / uncertainty</dt>
                            <dd>{entry.problem || 'No unresolved problem recorded.'}</dd>
                          </div>
                          <div className="research-log-entry__next">
                            <dt>Next step</dt>
                            <dd><ArrowRight size={14} /> {truncate(entry.nextStep, 220)}</dd>
                          </div>
                        </dl>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            title={data.researchLogs.length ? 'No log entries match these filters' : 'No research decisions logged yet'}
            description={
              data.researchLogs.length
                ? 'Clear the search or project filter to recover the wider audit trail.'
                : data.projects.length
                  ? 'Start with one material change and the next research move it implies.'
                  : 'Create a project first so every log entry has a real research context.'
            }
            action={
              data.researchLogs.length ? (
                <Button onClick={() => { setSearch(''); setProjectFilter('') }}>Clear filters</Button>
              ) : (
                <AddButton onClick={openCreate} disabled={!data.projects.length}>Add first entry</AddButton>
              )
            }
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title="Add a research log entry"
        description="Record the reasoning needed to understand this research move later."
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="research-log-form">Add entry</Button>
          </>
        }
      >
        <form id="research-log-form" className="form-grid" onSubmit={(event) => void saveEntry(event)}>
          <Field label="Research date" required>
            <input
              autoFocus
              required
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
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
          <Field label="What changed?" required className="form-span-2">
            <textarea
              required
              rows={3}
              value={draft.whatChanged}
              onChange={(event) => setDraft({ ...draft, whatChanged: event.target.value })}
              placeholder="Describe the empirical, theoretical, methodological, or writing change."
            />
          </Field>
          <Field label="Decision and rationale">
            <textarea
              rows={4}
              value={draft.decision}
              onChange={(event) => setDraft({ ...draft, decision: event.target.value })}
              placeholder="What did you decide, and on what grounds?"
            />
          </Field>
          <Field label="Problem or uncertainty">
            <textarea
              rows={4}
              value={draft.problem}
              onChange={(event) => setDraft({ ...draft, problem: event.target.value })}
              placeholder="What remains unresolved or threatens the inference?"
            />
          </Field>
          <Field label="Next step" required className="form-span-2">
            <textarea
              required
              rows={2}
              value={draft.nextStep}
              onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })}
              placeholder="Name the next concrete research move."
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
