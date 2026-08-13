import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FolderKanban, Network } from 'lucide-react'
import {
  PROJECT_STATUSES,
  RESEARCH_METHODS,
  type ResearchProject,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { daysUntil, entityMeta, todayIso, truncate } from '../../app/format'
import { QUICK_ADD_EVENT, type QuickAddEvent } from '../../app/navigationEvents'
import { useModuleSearch } from '../../hooks/useModuleSearch'
import { useI18n } from '../../i18n'
import {
  AddButton,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  FilterChips,
  DisclosureSection,
  Modal,
  PageHeader,
  SearchField,
  SectionHeader,
  StatCard,
  TableActions,
  type Tone,
} from '../../components/ui'
import { ResearchGraphWorkspace } from './ResearchGraphWorkspace'

interface ProjectDraft {
  title: string
  shortTitle: string
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

type ProjectView = 'all' | 'active' | 'theoretical' | 'completed'

function matchesProjectView(project: ResearchProject, view: ProjectView): boolean {
  if (view === 'active') return !['Published', 'Archived'].includes(project.status)
  if (view === 'theoretical') return project.method === 'Theoretical'
  if (view === 'completed') return project.status === 'Published' || project.status === 'Archived'
  return true
}

export function ProjectsPage() {
  const { data, updateData, setActiveProject } = useWorkspace()
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [detail, setDetail] = useState<ResearchProject | null>(null)
  const [editing, setEditing] = useState<ResearchProject | null>(null)
  const [deleting, setDeleting] = useState<ResearchProject | null>(null)
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft)
  const { searchParams, updateSearch } = useModuleSearch('projects')
  const view = (searchParams.get('view') || 'all') as ProjectView
  const statusQuery = searchParams.get('status') || ''
  const urlStatuses = useMemo(() => statusQuery.split(',').filter(Boolean), [statusQuery])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (
      data?.projects.filter((project) => {
        const matchesQuery =
          !query ||
          [
            project.title,
            project.shortTitle,
            project.topic,
            ...(data?.researchQuestions
              .filter((question) => question.projectId === project.id)
              .map((question) => question.text) ?? []),
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        const activeStatuses = view === 'active' ? urlStatuses : statusFilter ? [statusFilter] : []
        return matchesProjectView(project, view) && matchesQuery && (!activeStatuses.length || activeStatuses.includes(project.status)) && (!methodFilter || project.method === methodFilter)
      }) ?? []
    )
  }, [data?.projects, data?.researchQuestions, methodFilter, search, statusFilter, urlStatuses, view])

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as QuickAddEvent).detail
      if (detail?.module !== 'projects' || detail.action !== 'project') return
      setEditing(null)
      setDraft(emptyDraft())
      setFormOpen(true)
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  }, [])

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
      data.submissions.filter((item) => item.projectId === id).length +
      data.researchQuestions.filter((item) => item.projectId === id).length +
      data.claims.filter((item) => item.projectId === id).length +
      data.claimQuestionLinks.filter((item) => item.projectId === id).length +
      data.theoryMemos.filter((item) => item.projectId === id).length
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
      data.submissions.filter((item) => item.projectId === deleting.id).length +
      data.researchQuestions.filter((item) => item.projectId === deleting.id).length +
      data.claims.filter((item) => item.projectId === deleting.id).length +
      data.claimQuestionLinks.filter((item) => item.projectId === deleting.id).length +
      data.theoryMemos.filter((item) => item.projectId === deleting.id).length
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
        questions: data.researchQuestions.filter((item) => item.projectId === detail.id),
        claims: data.claims.filter((item) => item.projectId === detail.id),
        theoryMemos: data.theoryMemos.filter((item) => item.projectId === detail.id),
      }
    : null

  return (
    <div className="page">
      <PageHeader
        index="02"
        eyebrow={t('projects.header.eyebrow')}
        title={t('projects.header.title')}
        description={t('projects.header.description')}
        actions={<AddButton onClick={openCreate}>{t('projects.actions.new')}</AddButton>}
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('projects.stats.active')} value={formatNumber(activeCount)} detail={t('projects.stats.activeDetail')} tone="blue" />
        <StatCard label={t('projects.stats.writing')} value={formatNumber(inWriting)} detail={t('projects.stats.writingDetail')} tone="violet" />
        <StatCard label={t('projects.stats.deadline')} value={formatNumber(nearDeadline)} detail={t('projects.stats.deadlineDetail')} tone={nearDeadline ? 'warning' : 'neutral'} />
        <StatCard label={t('projects.stats.evidence')} value={formatNumber(data.evidence.length)} detail={t('projects.stats.evidenceDetail')} tone="accent" />
      </div>

      <section className="panel">
        {view === 'active' && <FilterChips
          ariaLabel={t('projects.filters.statusAria')}
          value={searchParams.get('status') || ''}
          onChange={(status) => updateSearch({ status })}
          options={[{ value: '', label: t('common.all') }, ...PROJECT_STATUSES.filter((status) => !['Published', 'Archived'].includes(status)).map((status) => ({ value: status, label: labelEnum(status) }))]}
        />}
        <div className="toolbar">
          <SearchField value={search} onChange={setSearch} placeholder={t('projects.filters.search')} />
          <div className="toolbar__filters">
            <select value={statusFilter} disabled={view === 'active'} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t('projects.filters.statusAria')}>
              <option value="">{t('projects.filters.allStages')}</option>
              {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
            </select>
            <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} aria-label={t('projects.filters.methodAria')}>
              <option value="">{t('projects.filters.allMethods')}</option>
              {RESEARCH_METHODS.map((method) => <option key={method} value={method}>{labelEnum(method)}</option>)}
            </select>
          </div>
          <span className="toolbar__count">{t('projects.filters.count', { visible: formatNumber(filtered.length), total: formatNumber(data.projects.length) })}</span>
        </div>

        {filtered.length ? (
          <div className="data-table-wrap">
            <table className="data-table projects-table">
              <thead>
                <tr>
                  <th>{t('projects.table.project')}</th>
                  <th>{t('projects.table.stage')}</th>
                  <th>{t('projects.table.method')}</th>
                  <th>{t('projects.table.target')}</th>
                  <th><span className="sr-only">{t('projects.table.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const days = daysUntil(project.targetDate)
                  const leadQuestion = data.researchQuestions.find((question) => question.projectId === project.id)
                  return (
                    <tr key={project.id}>
                      <td data-label={t('projects.table.project')}>
                        <button type="button" className="record-title" onClick={() => setDetail(project)}>
                          <strong>{project.title}</strong>
                          <span>{truncate(leadQuestion?.text || project.topic, 94)}</span>
                        </button>
                      </td>
                      <td data-label={t('projects.table.stage')}><Badge tone={statusTone(project.status)}>{labelEnum(project.status)}</Badge></td>
                      <td data-label={t('projects.table.method')}><span className="method-label">{labelEnum(project.method)}</span></td>
                      <td data-label={t('projects.table.target')}>
                        <span className={days !== null && days < 0 ? 'date-cell date-cell--overdue' : 'date-cell'}>
                          {formatDate(project.targetDate)}
                          {days !== null && days >= 0 && days <= 45 && <small>{t('projects.table.daysRemaining', { days: formatNumber(days) })}</small>}
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
            title={t(data.projects.length ? 'projects.empty.filteredTitle' : 'projects.empty.initialTitle')}
            description={t(data.projects.length ? 'projects.empty.filteredDescription' : 'projects.empty.initialDescription')}
            action={data.projects.length ? <Button onClick={() => { setSearch(''); setStatusFilter(''); setMethodFilter('') }}>{t('projects.actions.clearFilters')}</Button> : <AddButton onClick={openCreate}>{t('projects.actions.createFirst')}</AddButton>}
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title={t(editing ? 'projects.form.editTitle' : 'projects.form.createTitle')}
        description={t('projects.form.description')}
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" form="project-form" variant="primary">{t(editing ? 'projects.form.save' : 'projects.form.create')}</Button>
          </>
        }
      >
        <form id="project-form" className="form-grid" onSubmit={(event) => void saveProject(event)}>
          <Field label={t('projects.form.title')} required className="form-span-2">
            <input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t('projects.form.titlePlaceholder')} />
          </Field>
          <Field label={t('projects.form.method')} required>
            <select value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value as ResearchProject['method'] })}>
              {RESEARCH_METHODS.map((method) => <option key={method} value={method}>{labelEnum(method)}</option>)}
            </select>
          </Field>
          <Field label={t('projects.form.stage')} required>
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ResearchProject['status'] })}>
              {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
            </select>
          </Field>
          <DisclosureSection summary={t('common.moreOptions')} defaultOpen={Boolean(editing)}>
            <Field label={t('projects.form.shortTitle')} hint={t('projects.form.shortTitleHint')}><input value={draft.shortTitle} onChange={(event) => setDraft({ ...draft, shortTitle: event.target.value })} placeholder={t('projects.form.shortTitlePlaceholder')} /></Field>
            <Field label={t('projects.form.topic')} required><input required value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} placeholder={t('projects.form.topicPlaceholder')} /></Field>
            <Field label={t('projects.form.startDate')} required><input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></Field>
            <Field label={t('projects.form.targetDate')}><input type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} /></Field>
            <Field label={t('projects.form.notes')} className="form-span-2"><textarea rows={4} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder={t('projects.form.notesPlaceholder')} /></Field>
          </DisclosureSection>
        </form>
      </Modal>

      {detail && linked && (
        <Modal
          open
          title={detail.title}
          description={linked.questions[0]?.text || detail.topic}
          onClose={() => setDetail(null)}
          size="xl"
          footer={
            <>
              <Button onClick={() => void setActiveProject(detail.id)}>{t('projects.detail.makePrimary')}</Button>
              <Button variant="primary" onClick={() => openEdit(detail)}>{t('projects.detail.edit')}</Button>
            </>
          }
        >
          <div className="project-detail">
            <aside className="project-detail__summary">
              <Badge tone={statusTone(detail.status)}>{labelEnum(detail.status)}</Badge>
              <dl>
                <div><dt>{t('projects.detail.method')}</dt><dd>{labelEnum(detail.method)}</dd></div>
                <div><dt>{t('projects.detail.topic')}</dt><dd>{detail.topic}</dd></div>
                <div><dt>{t('projects.detail.started')}</dt><dd>{formatDate(detail.startDate)}</dd></div>
                <div><dt>{t('projects.detail.target')}</dt><dd>{formatDate(detail.targetDate)}</dd></div>
              </dl>
              {detail.notes && <p>{detail.notes}</p>}
            </aside>
            <div className="project-detail__workspace">
              <div className="linked-object-grid">
                {[
                  [t('projects.detail.currentTasks'), formatNumber(linked.tasks.filter((item) => item.status !== 'Done').length)],
                  [t('projects.detail.literature'), formatNumber(linked.literature.length)],
                  [t('projects.detail.dataFieldwork'), formatNumber(linked.fieldwork + linked.quantitative)],
                  [t('projects.detail.evidence'), formatNumber(linked.evidence.length)],
                  [t('projects.detail.manuscripts'), formatNumber(linked.manuscripts.length)],
                  [t('projects.detail.submissions'), formatNumber(linked.submissions.length)],
                  [t('projects.graph.questions.title'), formatNumber(linked.questions.length)],
                  [t('projects.graph.claims.title'), formatNumber(linked.claims.length)],
                  [t('projects.detail.theoryMemos'), formatNumber(linked.theoryMemos.length)],
                ].map(([label, count]) => (
                  <div key={label}><span>{label}</span><strong>{count}</strong></div>
                ))}
              </div>
              <section>
                <SectionHeader title={t('projects.detail.currentTasks')} description={t('projects.detail.tasksDescription')} />
                {linked.tasks.filter((item) => item.status !== 'Done').length ? (
                  <div className="compact-record-list">
                    {linked.tasks.filter((item) => item.status !== 'Done').slice(0, 5).map((item) => (
                      <article key={item.id}>
                        <span className="object-mark"><FolderKanban size={14} /></span>
                        <div><strong>{item.title}</strong><span>{labelEnum(item.category)} · {formatDate(item.dueDate)}</span></div>
                        <Badge tone={item.priority === 'Critical' ? 'danger' : 'neutral'}>{labelEnum(item.status)}</Badge>
                      </article>
                    ))}
                  </div>
                ) : <p className="quiet-copy">{t('projects.detail.noTasks')}</p>}
              </section>
              <section>
                <SectionHeader title={t('projects.detail.evidencePulse')} description={t('projects.detail.evidenceDescription')} />
                {linked.evidence.length ? (
                  <div className="compact-record-list">
                    {linked.evidence.slice(0, 4).map((item) => (
                      <article key={item.id}>
                        <span className="object-mark"><Network size={14} /></span>
                        <div><strong>{truncate(item.claim, 90)}</strong><span>{labelEnum(item.evidenceType)} · {item.source}</span></div>
                        <Badge tone={item.supportLevel === 'Strong' ? 'success' : item.supportLevel === 'Contradictory' ? 'danger' : 'warning'}>{labelEnum(item.supportLevel)}</Badge>
                      </article>
                    ))}
                  </div>
                ) : <p className="quiet-copy">{t('projects.detail.noEvidence')}</p>}
              </section>
              <ResearchGraphWorkspace projectId={detail.id} />
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(deleting) && deletingDependencies === 0}
        title={t('projects.delete.title', { name: deleting?.shortTitle || deleting?.title || t('projects.delete.fallbackName') })}
        description={t('projects.delete.description')}
        confirmLabel={t('projects.delete.confirm')}
        onCancel={() => setDeleting(null)}
        onConfirm={deleteProject}
      />
      <Modal
        open={Boolean(deleting) && deletingDependencies > 0}
        title={t('projects.delete.blockedTitle')}
        description={t('projects.delete.blockedDescription')}
        onClose={() => setDeleting(null)}
        size="sm"
        footer={<Button variant="primary" onClick={() => setDeleting(null)}>{t('projects.delete.keep')}</Button>}
      >
        <div className="confirm-panel confirm-panel--primary">
          <Network size={20} />
          <p>
            {t(deletingDependencies === 1 ? 'projects.delete.blockedOne' : 'projects.delete.blockedMany', { count: formatNumber(deletingDependencies) })}
          </p>
        </div>
      </Modal>
    </div>
  )
}
