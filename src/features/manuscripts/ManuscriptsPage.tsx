import { useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, FilePenLine } from 'lucide-react'
import {
  MANUSCRIPT_STATUSES,
  type Manuscript,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import {
  entityMeta,
  projectLabel,
  todayIso,
  truncate,
} from '../../app/format'
import { useI18n, type MessageKey } from '../../i18n'
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
  id: string
  labelKey: MessageKey
  descriptionKey: MessageKey
  statuses: Manuscript['status'][]
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'develop',
    labelKey: 'manuscripts.stage.develop.label',
    descriptionKey: 'manuscripts.stage.develop.description',
    statuses: ['Idea', 'Outline', 'Drafting'],
  },
  {
    id: 'internal',
    labelKey: 'manuscripts.stage.internal.label',
    descriptionKey: 'manuscripts.stage.internal.description',
    statuses: ['Internal Review', 'Ready to Submit'],
  },
  {
    id: 'external',
    labelKey: 'manuscripts.stage.external.label',
    descriptionKey: 'manuscripts.stage.external.description',
    statuses: ['Submitted', 'Under Review', 'Revision'],
  },
  {
    id: 'outcome',
    labelKey: 'manuscripts.stage.outcome.label',
    descriptionKey: 'manuscripts.stage.outcome.description',
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
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<ManuscriptDraft>(emptyDraft)

  const manuscriptCount = (count: number) => t(
    count === 1 ? 'manuscripts.count.manuscriptsOne' : 'manuscripts.count.manuscriptsOther',
    { count: formatNumber(count) },
  )
  const localizedProjectLabel = (projectId?: string) => {
    const project = data?.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }

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
        eyebrow={t('manuscripts.header.eyebrow')}
        title={t('manuscripts.header.title')}
        description={t('manuscripts.header.description')}
        actions={
          <AddButton
            onClick={openCreate}
            disabled={!data.projects.length}
            title={!data.projects.length ? t('manuscripts.disabled.noProject') : undefined}
          >
            {t('manuscripts.action.add')}
          </AddButton>
        }
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('manuscripts.stats.developing.label')} value={formatNumber(developing)} detail={t('manuscripts.stats.developing.detail')} tone="accent" />
        <StatCard label={t('manuscripts.stats.external.label')} value={formatNumber(external)} detail={t('manuscripts.stats.external.detail')} tone="violet" />
        <StatCard label={t('manuscripts.stats.accepted.label')} value={formatNumber(accepted)} detail={t(data.manuscripts.length === 1 ? 'manuscripts.stats.accepted.detailOne' : 'manuscripts.stats.accepted.detailOther', { count: formatNumber(data.manuscripts.length) })} tone="success" />
        <StatCard label={t('manuscripts.stats.milestones.label')} value={formatNumber(datedMilestones)} detail={t('manuscripts.stats.milestones.detail')} tone={datedMilestones ? 'warning' : 'neutral'} />
      </div>

      <section className="panel">
        <SectionHeader
          title={t('manuscripts.pipeline.title')}
          description={t('manuscripts.pipeline.description')}
        />
        <div className="toolbar toolbar--wrap">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t('manuscripts.search.placeholder')}
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
            aria-label={t('manuscripts.filter.statusLabel')}
          >
            <option value="">{t('manuscripts.filter.allStatuses')}</option>
            {MANUSCRIPT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
          </select>
          <span className="toolbar__count">{manuscriptCount(filtered.length)}</span>
        </div>

        {filtered.length ? (
          <div className="manuscript-pipeline">
            {PIPELINE_STAGES.map((stage) => {
              const manuscripts = filtered.filter((manuscript) =>
                stage.statuses.includes(manuscript.status),
              )
              return (
                <section className="pipeline-lane" key={stage.id}>
                  <header className="pipeline-lane__header">
                    <div>
                      <p className="eyebrow">{t('manuscripts.pipeline.stage')}</p>
                      <h2>{t(stage.labelKey)}</h2>
                      <p>{t(stage.descriptionKey)}</p>
                    </div>
                    <Badge>{formatNumber(manuscripts.length)}</Badge>
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
                            <Badge tone={statusTone(manuscript.status)}>{labelEnum(manuscript.status)}</Badge>
                          </header>
                          <h3>{manuscript.title}</h3>
                          <p className="manuscript-card__journal">
                            {manuscript.targetJournal || t('manuscripts.card.noJournal')}
                          </p>
                          <dl>
                            <div><dt>{t('manuscripts.card.project')}</dt><dd>{localizedProjectLabel(manuscript.projectId)}</dd></div>
                            <div><dt>{t('manuscripts.card.wordCount')}</dt><dd>{formatNumber(manuscript.wordCount)}</dd></div>
                            <div>
                              <dt>{t('manuscripts.card.deadline')}</dt>
                              <dd className={overdue ? 'text-danger' : ''}>
                                <CalendarClock size={13} /> {formatDate(manuscript.deadline)}
                              </dd>
                            </div>
                          </dl>
                          <div className="manuscript-card__next">
                            <span>{t('manuscripts.card.nextAction')}</span>
                            <p>{truncate(manuscript.nextAction || t('manuscripts.card.noNextAction'), 150)}</p>
                          </div>
                          <Field label={t('manuscripts.card.updateStatus')} className="field--compact">
                            <select
                              value={manuscript.status}
                              onChange={(event) => void updateStatus(
                                manuscript.id,
                                event.target.value as Manuscript['status'],
                              )}
                              aria-label={t('manuscripts.card.updateStatusFor', { title: manuscript.title })}
                            >
                              {MANUSCRIPT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
                            </select>
                          </Field>
                        </article>
                      )
                    }) : (
                      <p className="pipeline-lane__empty">{t('manuscripts.pipeline.noMatches')}</p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title={t(data.manuscripts.length ? 'manuscripts.empty.filteredTitle' : 'manuscripts.empty.initialTitle')}
            description={
              data.manuscripts.length
                ? t('manuscripts.empty.filteredDescription')
                : data.projects.length
                  ? t('manuscripts.empty.withProjectsDescription')
                  : t('manuscripts.empty.withoutProjectsDescription')
            }
            action={
              data.manuscripts.length ? (
                <Button onClick={() => { setSearch(''); setProjectFilter(''); setStatusFilter('') }}>{t('manuscripts.action.clearFilters')}</Button>
              ) : (
                <AddButton onClick={openCreate} disabled={!data.projects.length}>{t('manuscripts.action.addFirst')}</AddButton>
              )
            }
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title={t('manuscripts.dialog.title')}
        description={t('manuscripts.dialog.description')}
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="manuscript-form">{t('manuscripts.action.add')}</Button>
          </>
        }
      >
        <form id="manuscript-form" className="form-grid" onSubmit={(event) => void saveManuscript(event)}>
          <Field label={t('manuscripts.form.title')} required className="form-span-2">
            <input
              autoFocus
              required
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder={t('manuscripts.form.titlePlaceholder')}
            />
          </Field>
          <Field label={t('manuscripts.form.project')} required>
            <ProjectSelect
              required
              projects={data.projects}
              value={draft.projectId}
              onChange={(projectId) => setDraft({ ...draft, projectId })}
            />
          </Field>
          <Field label={t('manuscripts.form.journal')} required>
            <input
              required
              value={draft.targetJournal}
              onChange={(event) => setDraft({ ...draft, targetJournal: event.target.value })}
              placeholder={t('manuscripts.form.journalPlaceholder')}
            />
          </Field>
          <Field label={t('manuscripts.form.status')} required>
            <select
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value as Manuscript['status'] })}
            >
              {MANUSCRIPT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}
            </select>
          </Field>
          <Field label={t('manuscripts.form.wordCount')} required>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={draft.wordCount}
              onChange={(event) => setDraft({ ...draft, wordCount: event.target.value })}
            />
          </Field>
          <Field label={t('manuscripts.form.nextAction')} required className="form-span-2">
            <textarea
              required
              rows={3}
              value={draft.nextAction}
              onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })}
              placeholder={t('manuscripts.form.nextActionPlaceholder')}
            />
          </Field>
          <Field label={t('manuscripts.form.deadline')} className="form-span-2">
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
