import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, ScrollText } from 'lucide-react'
import type { ResearchLogEntry } from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import {
  entityMeta,
  projectLabel,
  todayIso,
  truncate,
} from '../../app/format'
import { QUICK_ADD_EVENT, type QuickAddEvent } from '../../app/navigationEvents'
import { useI18n } from '../../i18n'
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

const RESEARCH_LOG_VIEWS = ['timeline', 'today', 'week', 'decisions', 'problems', 'next-steps', 'by-project'] as const
type ResearchLogView = (typeof RESEARCH_LOG_VIEWS)[number]

function readResearchLogView(): ResearchLogView {
  const requested = new URLSearchParams(window.location.hash.split('?')[1] || '').get('view')
  return RESEARCH_LOG_VIEWS.includes(requested as ResearchLogView) ? requested as ResearchLogView : 'timeline'
}

function weekStart(date: string): string {
  const current = new Date(`${date}T12:00:00`)
  const mondayOffset = (current.getDay() + 6) % 7
  current.setDate(current.getDate() - mondayOffset)
  return current.toISOString().slice(0, 10)
}

export function ResearchLogPage() {
  const { data, updateData } = useWorkspace()
  const { t, formatDate, formatNumber } = useI18n()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<ResearchLogDraft>(emptyDraft)
  const [view, setView] = useState<ResearchLogView>(readResearchLogView)
  const previousViewRef = useRef<ResearchLogView | null>(null)
  const autoProjectFilterRef = useRef(false)

  useEffect(() => {
    const previousView = previousViewRef.current
    previousViewRef.current = view
    const hasValidProject = Boolean(projectFilter && data?.projects.some((project) => project.id === projectFilter))

    if (view === 'by-project') {
      if (!hasValidProject) {
        autoProjectFilterRef.current = true
        setProjectFilter(data?.workspace.activeProjectId || data?.projects[0]?.id || '')
      }
    } else if (previousView === 'by-project' && autoProjectFilterRef.current) {
      autoProjectFilterRef.current = false
      setProjectFilter('')
    }
  }, [data?.projects, data?.workspace.activeProjectId, projectFilter, view])

  const changeProjectFilter = (projectId: string) => {
    autoProjectFilterRef.current = false
    setProjectFilter(projectId)
  }

  useEffect(() => {
    const syncView = () => setView(readResearchLogView())
    window.addEventListener('hashchange', syncView)
    window.addEventListener('popstate', syncView)
    return () => {
      window.removeEventListener('hashchange', syncView)
      window.removeEventListener('popstate', syncView)
    }
  }, [])

  const entryCount = (count: number) => t(
    count === 1 ? 'researchLog.count.entriesOne' : 'researchLog.count.entriesOther',
    { count: formatNumber(count) },
  )
  const localizedProjectLabel = (projectId?: string) => {
    const project = data?.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }

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
          (view !== 'today' || entry.date === todayIso()) &&
          (view !== 'week' || entry.date >= weekStart(todayIso()) && entry.date <= todayIso()) &&
          (view !== 'decisions' || Boolean(entry.decision.trim())) &&
          (view !== 'problems' || Boolean(entry.problem.trim())) &&
          (view !== 'next-steps' || Boolean(entry.nextStep.trim())) &&
          (!query || corpus.includes(query)) &&
          (!projectFilter || entry.projectId === projectFilter)
        )
      })
      .sort((left, right) =>
        right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt),
      )
  }, [data?.projects, data?.researchLogs, projectFilter, search, view])

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as QuickAddEvent).detail
      if (detail?.module !== 'research-log' || detail.action !== 'research-log') return
      const projectId = data?.projects.some((project) => project.id === data?.workspace.activeProjectId)
        ? data?.workspace.activeProjectId || ''
        : data?.projects[0]?.id || ''
      if (!projectId) return
      setDraft(emptyDraft(projectId))
      setFormOpen(true)
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  }, [data?.projects, data?.workspace.activeProjectId])

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
        index="08"
        eyebrow={t('researchLog.header.eyebrow')}
        title={t('researchLog.header.title')}
        description={t('researchLog.header.description')}
        actions={
          <AddButton
            onClick={openCreate}
            disabled={!data.projects.length}
            title={!data.projects.length ? t('researchLog.disabled.noProject') : undefined}
          >
            {t('researchLog.action.add')}
          </AddButton>
        }
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('researchLog.stats.entries.label')} value={formatNumber(data.researchLogs.length)} detail={t('researchLog.stats.entries.detail')} tone="blue" />
        <StatCard label={t('researchLog.stats.month.label')} value={formatNumber(thisMonth)} detail={t('researchLog.stats.month.detail')} tone="accent" />
        <StatCard label={t('researchLog.stats.decisions.label')} value={formatNumber(decisions)} detail={t('researchLog.stats.decisions.detail')} tone="success" />
        <StatCard label={t('researchLog.stats.problems.label')} value={formatNumber(problems)} detail={t('researchLog.stats.problems.detail')} tone={problems ? 'warning' : 'neutral'} />
      </div>

      <section className="panel">
        <div className="toolbar toolbar--wrap">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t('researchLog.search.placeholder')}
          />
          <ProjectSelect
            projects={data.projects}
            value={projectFilter}
            onChange={changeProjectFilter}
            includeAll={view !== 'by-project'}
          />
          <span className="toolbar__count">
            {entryCount(filtered.length)}
          </span>
        </div>

        {timeline.length ? (
          <div className="research-log-timeline">
            {timeline.map((group) => (
              <section className="research-log-day" key={group.date}>
                <header className="research-log-day__header">
                  <span className="object-mark"><CalendarDays size={16} /></span>
                  <div>
                    <p className="eyebrow">{t('researchLog.timeline.date')}</p>
                    <h2>{formatDate(group.date)}</h2>
                  </div>
                  <Badge>{entryCount(group.entries.length)}</Badge>
                </header>
                <div className="research-log-day__entries">
                  {group.entries.map((entry) => (
                    <article className="research-log-entry" key={entry.id}>
                      <span className="research-log-entry__mark" aria-hidden="true">
                        <ScrollText size={15} />
                      </span>
                      <div className="research-log-entry__body">
                        <div className="badge-row">
                          <Badge tone="blue">{localizedProjectLabel(entry.projectId)}</Badge>
                          {entry.decision && <Badge tone="success">{t('researchLog.entry.decisionRecorded')}</Badge>}
                          {entry.problem && <Badge tone="warning">{t('researchLog.entry.problemRetained')}</Badge>}
                        </div>
                        <h3>{entry.whatChanged}</h3>
                        <dl className="research-log-entry__details">
                          <div>
                            <dt>{t('researchLog.entry.decision')}</dt>
                            <dd>{entry.decision || t('researchLog.entry.noDecision')}</dd>
                          </div>
                          <div>
                            <dt>{t('researchLog.entry.problem')}</dt>
                            <dd>{entry.problem || t('researchLog.entry.noProblem')}</dd>
                          </div>
                          <div className="research-log-entry__next">
                            <dt>{t('researchLog.entry.nextStep')}</dt>
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
            title={t(data.researchLogs.length ? 'researchLog.empty.filteredTitle' : 'researchLog.empty.initialTitle')}
            description={
              data.researchLogs.length
                ? t('researchLog.empty.filteredDescription')
                : data.projects.length
                  ? t('researchLog.empty.withProjectsDescription')
                  : t('researchLog.empty.withoutProjectsDescription')
            }
            action={
              data.researchLogs.length ? (
                <Button onClick={() => { setSearch(''); if (view !== 'by-project') changeProjectFilter('') }}>{t('researchLog.action.clearFilters')}</Button>
              ) : (
                <AddButton onClick={openCreate} disabled={!data.projects.length}>{t('researchLog.action.addFirst')}</AddButton>
              )
            }
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title={t('researchLog.dialog.title')}
        description={t('researchLog.dialog.description')}
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="research-log-form">{t('researchLog.dialog.submit')}</Button>
          </>
        }
      >
        <form id="research-log-form" className="form-grid" onSubmit={(event) => void saveEntry(event)}>
          <Field label={t('researchLog.form.date')} required>
            <input
              autoFocus
              required
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
          </Field>
          <Field label={t('researchLog.form.project')} required>
            <ProjectSelect
              required
              projects={data.projects}
              value={draft.projectId}
              onChange={(projectId) => setDraft({ ...draft, projectId })}
            />
          </Field>
          <Field label={t('researchLog.form.changed')} required className="form-span-2">
            <textarea
              required
              rows={3}
              value={draft.whatChanged}
              onChange={(event) => setDraft({ ...draft, whatChanged: event.target.value })}
              placeholder={t('researchLog.form.changedPlaceholder')}
            />
          </Field>
          <Field label={t('researchLog.form.decision')}>
            <textarea
              rows={4}
              value={draft.decision}
              onChange={(event) => setDraft({ ...draft, decision: event.target.value })}
              placeholder={t('researchLog.form.decisionPlaceholder')}
            />
          </Field>
          <Field label={t('researchLog.form.problem')}>
            <textarea
              rows={4}
              value={draft.problem}
              onChange={(event) => setDraft({ ...draft, problem: event.target.value })}
              placeholder={t('researchLog.form.problemPlaceholder')}
            />
          </Field>
          <Field label={t('researchLog.form.nextStep')} required className="form-span-2">
            <textarea
              required
              rows={2}
              value={draft.nextStep}
              onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })}
              placeholder={t('researchLog.form.nextStepPlaceholder')}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
