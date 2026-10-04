import { useContext, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ScrollText } from 'lucide-react'
import {
  PRIORITIES,
  TASK_CATEGORIES,
  type ResearchLogEntry,
  type ResearchTask,
  type WorkspaceData,
} from '../../models/domain'
import { useProjectWorkspace as useWorkspace } from '../../hooks/useProjectWorkspace'
import { useProjectScope } from '../../app/project-scope-context'
import { WorkspaceSessionContext } from '../../app/workspace-session-context'
import { entityMeta, isOverdue, todayIso } from '../../app/format'
import { QUICK_ADD_EVENT, type QuickAddEvent } from '../../app/navigationEvents'
import { useModuleSearch } from '../../hooks/useModuleSearch'
import { useLocalToday } from '../../hooks/useLocalToday'
import { useI18n } from '../../i18n'
import { ProjectSelect } from '../../components/ProjectSelect'
import {
  AddButton,
  Badge,
  Button,
  CheckRow,
  EmptyState,
  Field,
  FilterChips,
  Modal,
  PageHeader,
  SectionHeader,
  StatCard,
} from '../../components/ui'

const emptyTask = {
  title: '',
  projectId: '',
  category: 'Reading' as ResearchTask['category'],
  priority: 'Medium' as ResearchTask['priority'],
  dueDate: todayIso(),
  notes: '',
}

const emptyLog = {
  projectId: '',
  whatChanged: '',
  decision: '',
  problem: '',
  nextStep: '',
}

type TodayView = 'overview' | 'tasks' | 'week'

function dueWithinWeek(date: string | undefined, today: string): boolean {
  if (!date) return false
  const millisecondsPerDay = 86_400_000
  const dueIn = Math.round(
    (new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) /
      millisecondsPerDay,
  )
  return dueIn >= 0 && dueIn <= 6
}

function dueWithinPastWeek(date: string, today: string): boolean {
  const millisecondsPerDay = 86_400_000
  const age = Math.round(
    (new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) /
      millisecondsPerDay,
  )
  return age >= 0 && age <= 6
}

function isTrulyEmptyPersonalWorkspace(data: WorkspaceData): boolean {
  return !data.workspace.isDemo && [
    data.projects,
    data.researchQuestions,
    data.claims,
    data.claimQuestionLinks,
    data.theoryMemos,
    data.tasks,
    data.literature,
    data.fieldSites,
    data.fieldMaps,
    data.interviews,
    data.fieldVisits,
    data.datasets,
    data.analysisRuns,
    data.evidence,
    data.researchLogs,
    data.manuscripts,
    data.submissions,
    data.reviewerComments,
  ].every((collection) => collection.length === 0)
}

export function TodayPage() {
  const { projectId: scopeId } = useProjectScope()
  const { data, updateData, setActiveProject, saving } = useWorkspace()
  const workspaceSession = useContext(WorkspaceSessionContext)
  const { locale, t, formatDate, formatNumber, labelEnum } = useI18n()
  const [taskOpen, setTaskOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [task, setTask] = useState(emptyTask)
  const [editingTask, setEditingTask] = useState<ResearchTask | null>(null)
  const [taskMessage, setTaskMessage] = useState('')
  const [taskError, setTaskError] = useState(false)
  const taskSaving = useRef(false)
  const [log, setLog] = useState(emptyLog)
  const [goals, setGoals] = useState<string[] | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<ResearchTask['category'] | ''>('')
  const { searchParams, updateSearch } = useModuleSearch('today')
  const view = (searchParams.get('view') || 'overview') as TodayView
  const taskFilter = searchParams.get('filter') || 'all'

  const today = useLocalToday()
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${today}T12:00:00`))

  const relevantTasks = useMemo(() => {
    const filtered = (data?.tasks ?? []).filter((item) => {
      if (view === 'tasks' && taskFilter === 'today') return item.dueDate === today && item.status !== 'Done'
      if (view === 'tasks' && taskFilter === 'overdue') return isOverdue(item.dueDate, item.status, today)
      if (view === 'tasks' && taskFilter === 'upcoming') return item.status !== 'Done' && dueWithinWeek(item.dueDate, today)
      if (view === 'tasks' && taskFilter === 'completed') {
        return item.status === 'Done' && dueWithinPastWeek(item.updatedAt.slice(0, 10), today)
      }
      if (view === 'tasks') return true
      if (view === 'week') return item.status !== 'Done' && dueWithinWeek(item.dueDate, today)
      return item.dueDate === today || isOverdue(item.dueDate, item.status, today)
    })
    return filtered.sort((left, right) =>
      taskFilter === 'completed'
        ? right.updatedAt.localeCompare(left.updatedAt)
        : (left.dueDate || '').localeCompare(right.dueDate || ''),
    )
  }, [data?.tasks, taskFilter, today, view])
  const completedToday = relevantTasks.filter((item) => item.status === 'Done').length
  const overdue = relevantTasks.filter((item) => isOverdue(item.dueDate, item.status, today)).length
  const completionPercent = relevantTasks.length ? (completedToday / relevantTasks.length) * 100 : 0
  const safeCompletionPercent = Math.min(100, Math.max(0, completionPercent))
  const roundedCompletionPercent = Math.round(safeCompletionPercent)
  const todayLogs = data?.researchLogs.filter((item) => item.date === today) ?? []
  const activeProject = data?.projects.find((item) => item.id === data.workspace.activeProjectId)
  const visibleGoals = goals ?? data?.workspace.todayGoals ?? []
  const visibleTasks = relevantTasks.filter((item) => !categoryFilter || item.category === categoryFilter)

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as QuickAddEvent).detail
      if (detail?.module !== 'today' || detail.action !== 'task') return
      setTask({ ...emptyTask, dueDate: todayIso(), projectId: data?.workspace.activeProjectId || '' })
      setEditingTask(null)
      setTaskError(false)
      setTaskOpen(true)
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  }, [data?.workspace.activeProjectId])

  const localizedProjectLabel = (projectId?: string) => {
    const project = data?.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }

  if (!data) return null

  const showOnboarding = view === 'overview' && isTrulyEmptyPersonalWorkspace(data)

  const saveTask = async (event: FormEvent) => {
    event.preventDefault()
    if (taskSaving.current) return
    taskSaving.current = true
    setTaskError(false)
    const record: ResearchTask = {
      ...(editingTask || entityMeta('task')),
      ...task,
      title: task.title.trim(),
      dueDate: task.dueDate || undefined,
      updatedAt: new Date().toISOString(),
      isDemo: false,
      projectId: task.projectId || data.workspace.activeProjectId || '',
      status: editingTask?.status || 'To Do',
    }
    try {
      await updateData((current) => ({ ...current, tasks: editingTask ? current.tasks.map((item) => item.id === record.id ? { ...record, status: item.status, createdAt: item.createdAt } : item) : [record, ...current.tasks] }))
      setTask(emptyTask)
      setTaskOpen(false)
      setTaskMessage(t('feedback.task.saved'))
      setCategoryFilter('')
      updateSearch({ view: 'tasks', filter: 'all' })
    } catch {
      setTaskError(true)
    } finally {
      taskSaving.current = false
    }
  }

  const saveLog = async (event: FormEvent) => {
    event.preventDefault()
    const record: ResearchLogEntry = {
      ...entityMeta('log'),
      date: todayIso(),
      projectId: log.projectId || data.workspace.activeProjectId || '',
      whatChanged: log.whatChanged,
      decision: log.decision,
      problem: log.problem,
      nextStep: log.nextStep,
    }
    await updateData((current) => ({ ...current, researchLogs: [record, ...current.researchLogs] }))
    setLog(emptyLog)
    setLogOpen(false)
  }

  const toggleTask = async (record: ResearchTask) => {
    await updateData((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === record.id
          ? { ...item, status: item.status === 'Done' ? 'To Do' : 'Done', updatedAt: new Date().toISOString() }
          : item,
      ),
    }))
  }

  const saveGoals = async () => {
    const nextGoals = visibleGoals.map((goal) => goal.trim()).filter(Boolean).slice(0, 3)
    await updateData((current) => ({
      ...current,
      workspace: { ...current.workspace, todayGoals: nextGoals },
    }))
    setGoals(null)
  }

  const openTaskForm = () => {
    setTask({ ...emptyTask, dueDate: todayIso(), projectId: data.workspace.activeProjectId || data.projects[0]?.id || '' })
    setEditingTask(null)
    setTaskError(false)
    setTaskOpen(true)
  }

  const openEditTask = (item: ResearchTask) => {
    setEditingTask(item)
    setTaskError(false)
    setTask({ title: item.title, projectId: item.projectId, category: item.category, priority: item.priority, dueDate: item.dueDate || '', notes: item.notes })
    setTaskOpen(true)
  }

  const deadlineDays = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  const dueTodayCount = data.tasks.filter((item) => item.status !== 'Done' && item.dueDate === today).length
  const dueSoonCount = data.tasks.filter((item) => item.status !== 'Done' && item.dueDate && deadlineDays(item.dueDate) > 0 && deadlineDays(item.dueDate) <= 6).length
  const overdueCount = data.tasks.filter((item) => isOverdue(item.dueDate, item.status, today)).length

  const openLogForm = () => {
    setLog({ ...emptyLog, projectId: data.workspace.activeProjectId || '' })
    setLogOpen(true)
  }

  return (
    <div className="page page--today">
      <PageHeader
        index="01"
        eyebrow={dateLabel}
        title={t('today.header.title')}
        description={t('today.header.description')}
        actions={<AddButton onClick={openTaskForm}>{t('today.actions.addResearchTask')}</AddButton>}
      />

      {showOnboarding && (
        <section className="panel onboarding-card" aria-labelledby="today-onboarding-title">
          <p className="eyebrow">{t('today.onboarding.eyebrow')}</p>
          <h2 id="today-onboarding-title">{t('today.onboarding.title')}</h2>
          <p>{t('today.onboarding.description')}</p>
          <ol className="onboarding-steps">
            <li>{t('today.onboarding.stepProject')}</li>
            <li>{t('today.onboarding.stepQuestion')}</li>
            <li>{t('today.onboarding.stepTask')}</li>
            <li>{t('today.onboarding.stepBackup')}</li>
          </ol>
          <p className="onboarding-privacy">{t('today.onboarding.localOnly')}</p>
          {workspaceSession && <div className="onboarding-actions">
            <Button variant="primary" onClick={() => workspaceSession.openWorkspaceCenter('workspaces')}>
              {t('today.onboarding.createWorkspace')}
            </Button>
            <Button onClick={() => workspaceSession.openWorkspaceCenter('backup')}>
              {t('today.onboarding.restoreBackup')}
            </Button>
            <Button
              variant="ghost"
              disabled={!workspaceSession.workspaces.some((workspace) => workspace.kind === 'demo')}
              onClick={() => {
                const demo = workspaceSession.workspaces.find((workspace) => workspace.kind === 'demo')
                if (demo) void workspaceSession.selectWorkspace(demo.id)
              }}
            >
              {t('today.onboarding.viewDemo')}
            </Button>
          </div>}
        </section>
      )}

      {view === 'overview' && <>
      <section className="focus-strip">
        <div className="focus-strip__label">
          <span>{t('today.focus.primaryProject')}</span>
          <strong>{activeProject?.shortTitle || activeProject?.title || t('today.focus.choose')}</strong>
        </div>
        <ProjectSelect
          projects={data.projects}
          value={data.workspace.activeProjectId || ''}
          ariaLabel={t('today.focus.primaryProject')}
          onChange={(value) => void setActiveProject(value || undefined)}
        />
        {activeProject && (
          <div className="focus-strip__stage">
            <span>{t('today.focus.currentStage')}</span>
            <Badge tone="accent">{labelEnum(activeProject.status)}</Badge>
          </div>
        )}
      </section>

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('today.stats.dueToday')} value={formatNumber(relevantTasks.length - overdue)} detail={t('today.stats.dueTodayDetail')} tone="blue" />
        <StatCard label={t('today.stats.overdue')} value={formatNumber(overdue)} detail={t(overdue ? 'today.stats.needsTriage' : 'today.stats.deskClear')} tone={overdue ? 'danger' : 'success'} />
        <StatCard label={t('today.stats.decisionsLogged')} value={formatNumber(todayLogs.length)} detail={t('today.stats.auditTrail')} tone="violet" />
        <StatCard label={t('today.stats.completed')} value={formatNumber(completedToday)} detail={t('today.stats.completedDetail', { count: formatNumber(relevantTasks.length) })} tone="success" />
      </div>

      <div className="today-grid">
        <section className="panel panel--goals">
          <SectionHeader
            title={t(scopeId ? 'feedback.project.sharedGoals' : 'today.goals.title')}
            description={t('today.goals.description')}
            action={
              goals ? (
                <Button size="sm" variant="primary" onClick={() => void saveGoals()}>{t('today.goals.save')}</Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setGoals([...visibleGoals, '', '', ''].slice(0, 3))}>
                  {t('today.goals.edit')}
                </Button>
              )
            }
          />
          <div className="goal-list">
            {[0, 1, 2].map((index) => (
              <div className="goal-row" key={index}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {goals ? (
                  <input
                    value={visibleGoals[index] || ''}
                    aria-label={t('today.goals.inputAria', { index: formatNumber(index + 1) })}
                    onChange={(event) => {
                      const next = [...visibleGoals]
                      next[index] = event.target.value
                      setGoals(next)
                    }}
                    placeholder={t(index === 0 ? 'today.goals.firstPlaceholder' : 'today.goals.placeholder')}
                  />
                ) : (
                  <p>{visibleGoals[index] || <em>{t('today.goals.notDefined')}</em>}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel--progress">
          <SectionHeader title={t('today.progress.title')} description={t('today.progress.description')} />
          <div className="progress" aria-label={`${t('today.progress.label')}: ${formatNumber(roundedCompletionPercent)}%`}>
            <div className="progress__meta">
              <span>{t('today.progress.label')}</span>
              <strong>{formatNumber(roundedCompletionPercent)}%</strong>
            </div>
            <div className="progress__track">
              <span style={{ width: `${safeCompletionPercent}%` }} />
            </div>
          </div>
          <div className="task-type-grid">
            {TASK_CATEGORIES.map((category) => (
              <div key={category}>
                <span>{labelEnum(category)}</span>
                <strong>{formatNumber(relevantTasks.filter((item) => item.category === category && item.status !== 'Done').length)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      </>}

      <div className={view === 'overview' ? 'today-grid today-grid--lower' : 'today-grid today-grid--single'}>
        <section className="panel">
          <SectionHeader
            title={t('today.tasks.title')}
            description={t('feedback.task.description')}
            action={<Button size="sm" variant="ghost" onClick={openTaskForm}>{t('today.tasks.add')}</Button>}
          />
          {taskMessage && <p role="status" className="feedback-success">{taskMessage}</p>}
          <p className="task-deadline-summary">{t('feedback.task.reminder', { today: formatNumber(dueTodayCount), soon: formatNumber(dueSoonCount), overdue: formatNumber(overdueCount) })}</p>
          {view === 'tasks' && <FilterChips
            ariaLabel={t('today.tasks.viewFilter')}
            value={taskFilter}
            onChange={(filter) => updateSearch({ filter })}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'today', label: t('today.tasks.today') },
              { value: 'upcoming', label: t('feedback.task.upcoming') },
              { value: 'overdue', label: t('today.tasks.overdue') },
              { value: 'completed', label: t('today.tasks.completed') },
            ]}
          />}
          <label className="today-task-filter">
            <span className="sr-only">{t('today.tasks.categoryFilter')}</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ResearchTask['category'] | '')} aria-label={t('today.tasks.categoryFilter')}>
              <option value="">{t('today.tasks.allCategories')}</option>
              {TASK_CATEGORIES.map((category) => <option key={category} value={category}>{labelEnum(category)}</option>)}
            </select>
          </label>
          {visibleTasks.length ? (
            <div className="check-list">
              {visibleTasks.map((item) => (
                <div key={item.id} className="task-edit-row"><CheckRow
                  checked={item.status === 'Done'}
                  label={item.title}
                  onChange={() => void toggleTask(item)}
                  meta={
                    <>
                      {isOverdue(item.dueDate, item.status, today) && <Badge tone="danger">{t('today.tasks.overdue')}</Badge>}
                      <span className="task-deadline">{item.dueDate ? t('feedback.task.deadline', { date: formatDate(item.dueDate) }) : t('feedback.task.none')}</span>
                      {item.dueDate && item.status !== 'Done' && <Badge tone={deadlineDays(item.dueDate) < 0 ? 'danger' : deadlineDays(item.dueDate) <= 2 ? 'warning' : 'neutral'}>{t(deadlineDays(item.dueDate) < 0 ? 'feedback.task.late' : deadlineDays(item.dueDate) === 0 ? 'feedback.task.today' : 'feedback.task.remaining', { days: formatNumber(Math.abs(deadlineDays(item.dueDate))) })}</Badge>}
                      <span>{localizedProjectLabel(item.projectId)}</span>
                      <span>{labelEnum(item.category)}</span>
                    </>
                  }
                /><Button size="sm" variant="ghost" aria-label={t('feedback.task.editName', { title: item.title })} onClick={() => openEditTask(item)}>{t('feedback.task.edit')}</Button></div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t(categoryFilter ? 'today.tasks.filteredEmptyTitle' : 'today.tasks.emptyTitle')}
              description={t(categoryFilter ? 'today.tasks.filteredEmptyDescription' : 'today.tasks.emptyDescription')}
              action={categoryFilter
                ? <Button onClick={() => setCategoryFilter('')}>{t('today.tasks.clearCategoryFilter')}</Button>
                : <AddButton onClick={openTaskForm}>{t('today.tasks.emptyAction')}</AddButton>}
            />
          )}
        </section>

        {view === 'overview' && <section className="panel panel--log">
          <SectionHeader
            title={t('today.log.title')}
            description={t('today.log.description')}
            action={<Button size="sm" variant="ghost" onClick={openLogForm}>{t('today.log.add')}</Button>}
          />
          {todayLogs.length ? (
            <div className="mini-timeline">
              {todayLogs.slice(0, 4).map((entry) => (
                <article key={entry.id}>
                  <span className="mini-timeline__mark"><ScrollText size={14} /></span>
                  <div>
                    <strong>{entry.whatChanged}</strong>
                    <p>{entry.decision || entry.nextStep}</p>
                    <span>{localizedProjectLabel(entry.projectId)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('today.log.emptyTitle')}
              description={t('today.log.emptyDescription')}
              action={<Button onClick={openLogForm}>{t('today.log.emptyAction')}</Button>}
            />
          )}
        </section>}
      </div>

      <Modal
        open={taskOpen}
        title={t(editingTask ? 'feedback.task.editTitle' : 'today.taskForm.title')}
        description={t('today.taskForm.description')}
        onClose={() => { if (!taskSaving.current) setTaskOpen(false) }}
        footer={
          <>
            <Button disabled={saving} onClick={() => { if (!taskSaving.current) setTaskOpen(false) }}>{t('common.cancel')}</Button>
            <Button disabled={saving} variant="primary" type="submit" form="today-task-form">{t(editingTask ? 'common.save' : 'today.taskForm.submit')}</Button>
          </>
        }
      >
        <form id="today-task-form" className="form-grid" onSubmit={(event) => void saveTask(event)}>
          {taskError && <p role="alert" className="text-danger form-span-2">{t('feedback.task.failed')}</p>}
          <Field label={t('today.taskForm.task')} required className="form-span-2">
            <input required autoFocus value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} placeholder={t('today.taskForm.taskPlaceholder')} />
          </Field>
          <Field label={t('today.taskForm.project')} required>
            <ProjectSelect required projects={data.projects} value={task.projectId} onChange={(projectId) => setTask({ ...task, projectId })} />
          </Field>
          <Field label={t('today.taskForm.workMode')} required>
            <select value={task.category} onChange={(event) => setTask({ ...task, category: event.target.value as ResearchTask['category'] })}>
              {TASK_CATEGORIES.map((category) => <option key={category} value={category}>{labelEnum(category)}</option>)}
            </select>
          </Field>
          <Field label={t('today.taskForm.dueDate')}>
            <input type="date" value={task.dueDate} onChange={(event) => setTask({ ...task, dueDate: event.target.value })} />
          </Field>
          <Field label={t('today.taskForm.priority')}>
            <select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value as ResearchTask['priority'] })}>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{labelEnum(priority)}</option>)}
            </select>
          </Field>
          <Field label={t('today.taskForm.notes')} className="form-span-2">
            <textarea rows={3} value={task.notes} onChange={(event) => setTask({ ...task, notes: event.target.value })} placeholder={t('today.taskForm.notesPlaceholder')} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={logOpen}
        title={t('today.logForm.title')}
        description={t('today.logForm.description')}
        onClose={() => setLogOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setLogOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="today-log-form">{t('today.logForm.submit')}</Button>
          </>
        }
      >
        <form id="today-log-form" className="form-grid" onSubmit={(event) => void saveLog(event)}>
          <Field label={t('today.logForm.project')} required className="form-span-2">
            <ProjectSelect required projects={data.projects} value={log.projectId} onChange={(projectId) => setLog({ ...log, projectId })} />
          </Field>
          <Field label={t('today.logForm.whatChanged')} required className="form-span-2">
            <textarea required rows={3} value={log.whatChanged} onChange={(event) => setLog({ ...log, whatChanged: event.target.value })} />
          </Field>
          <Field label={t('today.logForm.decision')}>
            <textarea rows={3} value={log.decision} onChange={(event) => setLog({ ...log, decision: event.target.value })} />
          </Field>
          <Field label={t('today.logForm.problem')}>
            <textarea rows={3} value={log.problem} onChange={(event) => setLog({ ...log, problem: event.target.value })} />
          </Field>
          <Field label={t('today.logForm.nextStep')} required className="form-span-2">
            <input required value={log.nextStep} onChange={(event) => setLog({ ...log, nextStep: event.target.value })} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
