import { useId, useMemo } from 'react'
import { useLocalToday } from '../../hooks/useLocalToday'
import { useI18n } from '../../i18n'
import type { WorkspaceData } from '../../models/domain'
import { buildProjectOverview, type RecordKind } from './research-index'

interface ProjectResearchOverviewProps {
  data: WorkspaceData
  /** Empty means all projects; choosing a card never changes workspace scope. */
  projectId: string
  onBrowse: (projectId: string, kind: RecordKind) => void
}

function CountButton({ label, value, onClick }: {
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <li>
      <button className="project-overview__count" type="button" aria-label={`${label} ${value}`} onClick={onClick}>
        <span>{label}</span>
        <strong>{value}</strong>
      </button>
    </li>
  )
}

/** A read-only projection of the full snapshot, never a project completion score. */
export function ProjectResearchOverview({ data, projectId, onBrowse }: ProjectResearchOverviewProps) {
  const { t, formatDate, formatNumber } = useI18n()
  const today = useLocalToday()
  const descriptionId = useId()
  const projects = useMemo(() => buildProjectOverview(data, today), [data, today])
  const visibleProjects = projectId ? projects.filter((project) => project.projectId === projectId) : projects
  const ratio = (part: number, total: number) => `${formatNumber(part)} / ${formatNumber(total)}`

  return (
    <section className="project-overview" aria-label={t('overview.title')} aria-describedby={descriptionId}>
      <div id={descriptionId} className="project-overview__intro">
        <p>{t('overview.description')}</p>
        <p>{t('overview.browseHint')}</p>
      </div>
      {visibleProjects.length === 0 ? (
        <p className="project-overview__empty">{t(projectId ? 'overview.missingProject' : 'overview.empty')}</p>
      ) : visibleProjects.map((project) => {
        const browse = (kind: RecordKind) => () => onBrowse(project.projectId, kind)
        return (
          <article className="project-overview__project" key={project.projectId} aria-label={project.title}>
            <h3>{project.title}</h3>
            <div className="project-overview__groups">
              <section className="project-overview__group" aria-label={t('overview.tasks')}>
                <h4>{t('overview.tasks')}</h4>
                <ul>
                  <CountButton label={t('overview.totalTasks')} value={formatNumber(project.totalTasks)} onClick={browse('task')} />
                  <CountButton label={t('overview.doneTasks')} value={ratio(project.doneTasks, project.totalTasks)} onClick={browse('task')} />
                  <CountButton label={t('overview.overdueTasks')} value={formatNumber(project.overdueTasks)} onClick={browse('task')} />
                  <CountButton label={t('overview.upcomingTasks')} value={formatNumber(project.upcomingTasks)} onClick={browse('task')} />
                </ul>
                <p className="project-overview__note">{t('overview.taskNote', { date: formatDate(today) })}</p>
              </section>
              <section className="project-overview__group" aria-label={t('overview.questionsAndClaims')}>
                <h4>{t('overview.questionsAndClaims')}</h4>
                <ul>
                  <CountButton label={t('overview.openQuestions')} value={formatNumber(project.openQuestions)} onClick={browse('question')} />
                  <CountButton label={t('overview.unlinkedQuestions')} value={formatNumber(project.unlinkedQuestions)} onClick={browse('question')} />
                  <CountButton label={t('overview.claims')} value={formatNumber(project.claims)} onClick={browse('claim')} />
                  <CountButton label={t('overview.theoryMemos')} value={formatNumber(project.theoryMemos)} onClick={browse('theory')} />
                </ul>
                <p className="project-overview__note">{t('overview.questionNote')}</p>
              </section>
              <section className="project-overview__group" aria-label={t('overview.materialsAndFieldwork')}>
                <h4>{t('overview.materialsAndFieldwork')}</h4>
                <ul>
                  <CountButton label={t('overview.literature')} value={formatNumber(project.literature)} onClick={browse('literature')} />
                  <CountButton label={t('overview.fieldSites')} value={formatNumber(project.fieldSites)} onClick={browse('site')} />
                  <CountButton label={t('overview.mappedSites')} value={ratio(project.mappedSites, project.fieldSites)} onClick={browse('map')} />
                  <CountButton label={t('overview.interviews')} value={formatNumber(project.interviews)} onClick={browse('interview')} />
                  <CountButton label={t('overview.datasets')} value={formatNumber(project.datasets)} onClick={browse('dataset')} />
                  <CountButton label={t('overview.analysisRuns')} value={formatNumber(project.analysisRuns)} onClick={browse('analysis')} />
                </ul>
                <p className="project-overview__note">{t('overview.mapNote')}</p>
              </section>
              <section className="project-overview__group" aria-label={t('overview.writingAndReviews')}>
                <h4>{t('overview.writingAndReviews')}</h4>
                <ul>
                  <CountButton label={t('overview.evidence')} value={formatNumber(project.evidence)} onClick={browse('evidence')} />
                  <CountButton label={t('overview.manuscripts')} value={formatNumber(project.manuscripts)} onClick={browse('manuscript')} />
                  <CountButton label={t('overview.openReviews')} value={formatNumber(project.openReviews)} onClick={browse('review')} />
                </ul>
              </section>
            </div>
          </article>
        )
      })}
    </section>
  )
}
