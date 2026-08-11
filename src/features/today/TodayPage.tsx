import { useMemo, useState, type FormEvent } from 'react'
import { ScrollText } from 'lucide-react'
import {
  PRIORITIES,
  TASK_CATEGORIES,
  type ResearchLogEntry,
  type ResearchTask,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { entityMeta, isOverdue, projectLabel, todayIso } from '../../app/format'
import { ProjectSelect } from '../../components/ProjectSelect'
import {
  AddButton,
  Badge,
  Button,
  CheckRow,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  ProgressBar,
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

export function TodayPage() {
  const { data, updateData, setActiveProject } = useWorkspace()
  const [taskOpen, setTaskOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [task, setTask] = useState(emptyTask)
  const [log, setLog] = useState(emptyLog)
  const [goals, setGoals] = useState<string[] | null>(null)

  const today = todayIso()
  const dateLabel = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${today}T12:00:00`))

  const relevantTasks = useMemo(
    () =>
      data?.tasks
        .filter((item) => item.dueDate === today || isOverdue(item.dueDate, item.status))
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')) ?? [],
    [data?.tasks, today],
  )
  const completedToday = relevantTasks.filter((item) => item.status === 'Done').length
  const overdue = relevantTasks.filter((item) => isOverdue(item.dueDate, item.status)).length
  const todayLogs = data?.researchLogs.filter((item) => item.date === today) ?? []
  const activeProject = data?.projects.find((item) => item.id === data.workspace.activeProjectId)
  const visibleGoals = goals ?? data?.workspace.todayGoals ?? []

  if (!data) return null

  const saveTask = async (event: FormEvent) => {
    event.preventDefault()
    const record: ResearchTask = {
      ...entityMeta('task'),
      ...task,
      projectId: task.projectId || data.workspace.activeProjectId || '',
      status: 'To Do',
    }
    await updateData((current) => ({ ...current, tasks: [record, ...current.tasks] }))
    setTask(emptyTask)
    setTaskOpen(false)
  }

  const saveLog = async (event: FormEvent) => {
    event.preventDefault()
    const record: ResearchLogEntry = {
      ...entityMeta('log'),
      date: today,
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
    setTask({ ...emptyTask, projectId: data.workspace.activeProjectId || '' })
    setTaskOpen(true)
  }

  const openLogForm = () => {
    setLog({ ...emptyLog, projectId: data.workspace.activeProjectId || '' })
    setLogOpen(true)
  }

  return (
    <div className="page page--today">
      <PageHeader
        index="01"
        eyebrow={dateLabel}
        title="Today’s research desk"
        description="Protect a small set of consequential research moves from the noise of ordinary task management."
        actions={<AddButton onClick={openTaskForm}>Add research task</AddButton>}
      />

      <section className="focus-strip">
        <div className="focus-strip__label">
          <span>Primary project</span>
          <strong>{activeProject?.shortTitle || activeProject?.title || 'Choose a research focus'}</strong>
        </div>
        <ProjectSelect
          projects={data.projects}
          value={data.workspace.activeProjectId || ''}
          onChange={(value) => void setActiveProject(value || undefined)}
        />
        {activeProject && (
          <div className="focus-strip__stage">
            <span>Current stage</span>
            <Badge tone="accent">{activeProject.status}</Badge>
          </div>
        )}
      </section>

      <div className="stats-grid stats-grid--four">
        <StatCard label="Due today" value={relevantTasks.length - overdue} detail="across research objects" tone="blue" />
        <StatCard label="Overdue" value={overdue} detail={overdue ? 'needs triage' : 'desk is clear'} tone={overdue ? 'danger' : 'success'} />
        <StatCard label="Decisions logged" value={todayLogs.length} detail="today’s audit trail" tone="violet" />
        <StatCard label="Completed" value={completedToday} detail={`of ${relevantTasks.length} visible tasks`} tone="success" />
      </div>

      <div className="today-grid">
        <section className="panel panel--goals">
          <SectionHeader
            title="Three research outcomes"
            description="Frame outcomes, not errands. What should be materially different by tonight?"
            action={
              goals ? (
                <Button size="sm" variant="primary" onClick={() => void saveGoals()}>Save goals</Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setGoals([...visibleGoals, '', '', ''].slice(0, 3))}>
                  Edit
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
                    onChange={(event) => {
                      const next = [...visibleGoals]
                      next[index] = event.target.value
                      setGoals(next)
                    }}
                    placeholder={index === 0 ? 'Resolve the central analytical uncertainty' : 'Name a concrete research outcome'}
                  />
                ) : (
                  <p>{visibleGoals[index] || <em>Outcome not yet defined</em>}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel--progress">
          <SectionHeader title="Completion signal" description="A narrow pulse, not a productivity score." />
          <ProgressBar
            value={relevantTasks.length ? (completedToday / relevantTasks.length) * 100 : 0}
            label="Visible work complete"
          />
          <div className="task-type-grid">
            {TASK_CATEGORIES.slice(0, 5).map((category) => (
              <div key={category}>
                <span>{category}</span>
                <strong>{relevantTasks.filter((item) => item.category === category && item.status !== 'Done').length}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="today-grid today-grid--lower">
        <section className="panel">
          <SectionHeader
            title="Research tasks"
            description="Today and overdue, ordered by due date."
            action={<Button size="sm" variant="ghost" onClick={openTaskForm}>Add task</Button>}
          />
          {relevantTasks.length ? (
            <div className="check-list">
              {relevantTasks.map((item) => (
                <CheckRow
                  key={item.id}
                  checked={item.status === 'Done'}
                  label={item.title}
                  onChange={() => void toggleTask(item)}
                  meta={
                    <>
                      {isOverdue(item.dueDate, item.status) && <Badge tone="danger">Overdue</Badge>}
                      <span>{projectLabel(data.projects, item.projectId)}</span>
                      <span>{item.category}</span>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No immediate research tasks"
              description="Add work that advances reading, analysis, fieldwork, writing, or submission."
              action={<AddButton onClick={openTaskForm}>Add a task</AddButton>}
            />
          )}
        </section>

        <section className="panel panel--log">
          <SectionHeader
            title="Today’s research log"
            description="Capture a change, decision, problem, and next step."
            action={<Button size="sm" variant="ghost" onClick={openLogForm}>Add entry</Button>}
          />
          {todayLogs.length ? (
            <div className="mini-timeline">
              {todayLogs.slice(0, 4).map((entry) => (
                <article key={entry.id}>
                  <span className="mini-timeline__mark"><ScrollText size={14} /></span>
                  <div>
                    <strong>{entry.whatChanged}</strong>
                    <p>{entry.decision || entry.nextStep}</p>
                    <span>{projectLabel(data.projects, entry.projectId)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No decision trail yet"
              description="A short entry now makes tomorrow’s reasoning recoverable."
              action={<Button onClick={openLogForm}>Open research log</Button>}
            />
          )}
        </section>
      </div>

      <Modal
        open={taskOpen}
        title="Add a research task"
        description="Tie the task to a research object and name the mode of work."
        onClose={() => setTaskOpen(false)}
        footer={
          <>
            <Button onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="today-task-form">Add task</Button>
          </>
        }
      >
        <form id="today-task-form" className="form-grid" onSubmit={(event) => void saveTask(event)}>
          <Field label="Task" required className="form-span-2">
            <input required autoFocus value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} placeholder="e.g. Test the alternative age specification" />
          </Field>
          <Field label="Project" required>
            <ProjectSelect required projects={data.projects} value={task.projectId} onChange={(projectId) => setTask({ ...task, projectId })} />
          </Field>
          <Field label="Work mode" required>
            <select value={task.category} onChange={(event) => setTask({ ...task, category: event.target.value as ResearchTask['category'] })}>
              {TASK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={task.dueDate} onChange={(event) => setTask({ ...task, dueDate: event.target.value })} />
          </Field>
          <Field label="Priority">
            <select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value as ResearchTask['priority'] })}>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </Field>
          <Field label="Notes" className="form-span-2">
            <textarea rows={3} value={task.notes} onChange={(event) => setTask({ ...task, notes: event.target.value })} placeholder="Constraints, inputs, or the definition of done" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={logOpen}
        title="Add today’s research log"
        description="Record reasoning that future-you should be able to audit."
        onClose={() => setLogOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="today-log-form">Add log entry</Button>
          </>
        }
      >
        <form id="today-log-form" className="form-grid" onSubmit={(event) => void saveLog(event)}>
          <Field label="Project" required className="form-span-2">
            <ProjectSelect required projects={data.projects} value={log.projectId} onChange={(projectId) => setLog({ ...log, projectId })} />
          </Field>
          <Field label="What changed?" required className="form-span-2">
            <textarea required rows={3} value={log.whatChanged} onChange={(event) => setLog({ ...log, whatChanged: event.target.value })} />
          </Field>
          <Field label="Decision and rationale">
            <textarea rows={3} value={log.decision} onChange={(event) => setLog({ ...log, decision: event.target.value })} />
          </Field>
          <Field label="Problem or uncertainty">
            <textarea rows={3} value={log.problem} onChange={(event) => setLog({ ...log, problem: event.target.value })} />
          </Field>
          <Field label="Next step" required className="form-span-2">
            <input required value={log.nextStep} onChange={(event) => setLog({ ...log, nextStep: event.target.value })} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
