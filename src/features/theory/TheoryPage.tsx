import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FilePenLine, Link2, Network } from 'lucide-react'
import { ProjectSelect } from '../../components/ProjectSelect'
import { QUICK_ADD_EVENT, type QuickAddEvent } from '../../app/navigationEvents'
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatCard,
} from '../../components/ui'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useI18n } from '../../i18n'
import { useModuleSearch } from '../../hooks/useModuleSearch'
import type { Claim, Manuscript, TheoryMemo } from '../../models/domain'
import { ResearchGraphWorkspace } from '../projects/ResearchGraphWorkspace'
import { TheoryMemoWorkspace } from './TheoryMemoWorkspace'
import {
  isTheoryView,
  prioritizeTheoryProjects,
  type TheoryView,
} from './theoryViews'

export function TheoryPage() {
  const { data } = useWorkspace()
  const { t } = useI18n()
  const { searchParams, updateSearch } = useModuleSearch('theory')
  const [projectFilter, setProjectFilter] = useState('')
  const [questionProjectId, setQuestionProjectId] = useState('')
  const [createRequest, setCreateRequest] = useState(0)
  const requestedView = searchParams.get('view')
  const view: TheoryView = isTheoryView(requestedView) ? requestedView : 'overview'

  const projects = useMemo(() => prioritizeTheoryProjects(data?.projects ?? []), [data?.projects])

  const selectView = useCallback((nextView: TheoryView) => {
    updateSearch({ view: nextView, type: null })
  }, [updateSearch])

  const newMemo = useCallback(() => {
    if (view !== 'memos') selectView('memos')
    setCreateRequest((current) => current + 1)
  }, [selectView, view])

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as QuickAddEvent).detail
      if (detail?.module === 'theory' && detail.action === 'theory-memo') newMemo()
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  }, [newMemo])

  if (!data) return null

  const selectedQuestionProject = questionProjectId || data.workspace.activeProjectId || projects[0]?.id || ''

  return (
    <div className="page page--theory">
      <PageHeader
        index="04"
        eyebrow={t('theory.header.eyebrow')}
        title={t('theory.header.title')}
        description={t('theory.header.description')}
      />

      {view === 'overview' && (
        <TheoryOverview
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
        />
      )}

      {view === 'questions' && (
        <section className="panel theory-questions-panel">
          <SectionHeader
            title={t('theory.views.questions')}
            description={t('theory.questions.description')}
          />
          <label className="theory-project-picker">
            <span>{t('theory.questions.project')}</span>
            <ProjectSelect
              required
              projects={projects}
              value={selectedQuestionProject}
              onChange={setQuestionProjectId}
            />
          </label>
          {selectedQuestionProject ? (
            <ResearchGraphWorkspace projectId={selectedQuestionProject} />
          ) : (
            <EmptyState
              title={t('theory.questions.emptyTitle')}
              description={t('theory.questions.emptyDescription')}
            />
          )}
        </section>
      )}

      {view === 'memos' && (
        <TheoryMemoWorkspace
          typeFilter={searchParams.get('type') || ''}
          onTypeFilterChange={(type) => updateSearch({ type })}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          createRequest={createRequest}
          onCreateRequestHandled={() => setCreateRequest(0)}
        />
      )}

      {view === 'manuscripts' && (
        <TheoryManuscripts
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
        />
      )}
    </div>
  )
}

function TheoryOverview({
  projectFilter,
  onProjectFilterChange,
}: {
  projectFilter: string
  onProjectFilterChange: (projectId: string) => void
}) {
  const { data } = useWorkspace()
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  if (!data) return null

  const projects = prioritizeTheoryProjects(data.projects)
  const inScope = (projectId: string) => !projectFilter || projectId === projectFilter
  const questions = data.researchQuestions.filter((item) => inScope(item.projectId))
  const claims = data.claims.filter((item) => inScope(item.projectId))
  const memos = data.theoryMemos.filter((item) => inScope(item.projectId))
  const manuscripts = prioritizeManuscripts(data.manuscripts, data.projects)
    .filter((item) => inScope(item.projectId))
  const unlinkedClaims = claims.filter((claim) => !data.claimQuestionLinks.some((link) => link.claimId === claim.id))
  const projectLabel = (projectId: string) => {
    const project = data.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.notSet')
  }

  return (
    <div className="theory-overview">
      <section className="panel theory-overview__projects">
        <SectionHeader
          title={t('theory.overview.projects')}
          description={t('theory.overview.projectsDescription')}
          action={
            <ProjectSelect
              projects={projects}
              value={projectFilter}
              onChange={onProjectFilterChange}
              includeAll
              allLabel={t('theory.filters.allProjects')}
              ariaLabel={t('theory.filters.project')}
            />
          }
        />
        {projects.length ? (
          <div className="theory-project-strip" role="list">
            {projects.map((project) => (
              <div key={project.id} role="listitem">
                <button
                  type="button"
                  aria-pressed={projectFilter === project.id}
                  onClick={() => onProjectFilterChange(projectFilter === project.id ? '' : project.id)}
                >
                  <span>{project.method === 'Theoretical' ? <Network size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}</span>
                  <strong>{project.shortTitle || project.title}</strong>
                  <small>{labelEnum(project.method)} · {labelEnum(project.status)}</small>
                </button>
              </div>
            ))}
          </div>
        ) : <p className="quiet-copy">{t('theory.overview.noProjects')}</p>}
      </section>

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('theory.overview.questions')} value={formatNumber(questions.length)} tone="blue" />
        <StatCard label={t('theory.overview.claims')} value={formatNumber(claims.length)} tone="violet" />
        <StatCard label={t('theory.overview.memos')} value={formatNumber(memos.length)} tone="accent" />
        <StatCard label={t('theory.overview.theoreticalProjects')} value={formatNumber(projects.filter((item) => item.method === 'Theoretical').length)} tone="neutral" />
      </div>

      <div className="theory-overview__grid">
        <OverviewList
          title={t('theory.overview.recentMemos')}
          description={t('theory.overview.recentMemosDescription')}
          empty={t('theory.overview.noMemos')}
          rows={[...memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5).map((memo) => ({
            id: memo.id,
            title: memo.title,
            meta: `${labelEnum(memo.memoType)} · ${projectLabel(memo.projectId)} · ${formatDate(memo.updatedAt)}`,
            badge: labelEnum(memo.memoType),
          }))}
        />
        <OverviewList
          title={t('theory.overview.unlinkedClaims')}
          description={t('theory.overview.unlinkedClaimsDescription')}
          empty={t('theory.overview.noUnlinkedClaims')}
          rows={unlinkedClaims.slice(0, 5).map((claim: Claim) => ({
            id: claim.id,
            title: claim.text,
            meta: projectLabel(claim.projectId),
            badge: labelEnum(claim.status),
          }))}
        />
        <OverviewList
          className="theory-overview__wide"
          title={t('theory.overview.recentManuscripts')}
          description={t('theory.overview.recentManuscriptsDescription')}
          empty={t('theory.overview.noManuscripts')}
          rows={manuscripts.slice(0, 5).map((manuscript) => ({
            id: manuscript.id,
            title: manuscript.title,
            meta: `${projectLabel(manuscript.projectId)} · ${formatDate(manuscript.updatedAt)}`,
            badge: labelEnum(manuscript.status),
          }))}
        />
      </div>
    </div>
  )
}

function OverviewList({
  title,
  description,
  empty,
  rows,
  className = '',
}: {
  title: string
  description: string
  empty: string
  rows: Array<{ id: string; title: string; meta: string; badge: string }>
  className?: string
}) {
  return (
    <section className={`panel theory-overview-list ${className}`}>
      <SectionHeader title={title} description={description} />
      {rows.length ? (
        <div className="compact-record-list">
          {rows.map((row) => (
            <article key={row.id}>
              <span className="object-mark"><ArrowRight size={14} aria-hidden="true" /></span>
              <div><strong>{row.title}</strong><span>{row.meta}</span></div>
              <Badge tone="neutral">{row.badge}</Badge>
            </article>
          ))}
        </div>
      ) : <p className="quiet-copy">{empty}</p>}
    </section>
  )
}

function prioritizeManuscripts(manuscripts: Manuscript[], projects: Array<{ id: string; method: string }>) {
  const theoreticalIds = new Set(projects.filter((project) => project.method === 'Theoretical').map((project) => project.id))
  return [...manuscripts].sort((left, right) => {
    const methodOrder = Number(theoreticalIds.has(right.projectId)) - Number(theoreticalIds.has(left.projectId))
    return methodOrder || right.updatedAt.localeCompare(left.updatedAt)
  })
}

function TheoryManuscripts({
  projectFilter,
  onProjectFilterChange,
}: {
  projectFilter: string
  onProjectFilterChange: (projectId: string) => void
}) {
  const { data } = useWorkspace()
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  if (!data) return null
  const projects = prioritizeTheoryProjects(data.projects)
  const manuscripts = prioritizeManuscripts(data.manuscripts, data.projects)
    .filter((item) => !projectFilter || item.projectId === projectFilter)
  const projectLabel = (projectId: string) => {
    const project = data.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.notSet')
  }

  return (
    <section className="panel theory-manuscripts">
      <SectionHeader
        title={t('theory.manuscripts.title')}
        description={t('theory.manuscripts.description')}
        action={<Link className="button button--secondary button--sm" to="/manuscripts"><FilePenLine size={15} aria-hidden="true" /><span>{t('theory.manuscripts.openPublishing')}</span></Link>}
      />
      <div className="toolbar">
        <ProjectSelect
          projects={projects}
          value={projectFilter}
          onChange={onProjectFilterChange}
          includeAll
          allLabel={t('theory.filters.allProjects')}
          ariaLabel={t('theory.filters.project')}
        />
        <span className="toolbar__count">{formatNumber(manuscripts.length)}</span>
      </div>
      {manuscripts.length ? (
        <div className="theory-manuscript-grid" role="list">
          {manuscripts.map((manuscript: Manuscript) => (
            <article key={manuscript.id} role="listitem">
              <header><Badge tone="violet">{labelEnum(manuscript.status)}</Badge><span>{formatDate(manuscript.updatedAt)}</span></header>
              <h3>{manuscript.title}</h3>
              <p>{projectLabel(manuscript.projectId)}</p>
              <dl>
                <div><dt>{t('theory.manuscripts.targetJournal')}</dt><dd>{manuscript.targetJournal || t('common.notSet')}</dd></div>
                <div><dt>{t('theory.manuscripts.nextAction')}</dt><dd>{manuscript.nextAction || t('common.notSet')}</dd></div>
              </dl>
              <footer>{t('theory.manuscripts.words', { count: formatNumber(manuscript.wordCount) })}</footer>
            </article>
          ))}
        </div>
      ) : <EmptyState title={t('theory.overview.noManuscripts')} description={t('theory.manuscripts.description')} />}
    </section>
  )
}

export type { TheoryMemo }
