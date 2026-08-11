import type { ResearchProject } from '../models/domain'
import { useI18n } from '../i18n'

export function ProjectSelect({
  projects,
  value,
  onChange,
  includeAll = false,
  allLabel,
  ariaLabel,
  required = false,
  disabled = false,
}: {
  projects: ResearchProject[]
  value: string
  onChange: (value: string) => void
  includeAll?: boolean
  allLabel?: string
  ariaLabel?: string
  required?: boolean
  disabled?: boolean
}) {
  const { t } = useI18n()
  return (
    <select
      value={value}
      aria-label={ariaLabel || (includeAll ? t('common.projectFilter') : undefined)}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      disabled={disabled}
    >
      {includeAll ? (
        <option value="">{allLabel || t('common.allProjects')}</option>
      ) : (
        <option value="">{required ? t('common.selectProject') : t('common.unassigned')}</option>
      )}
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.shortTitle || project.title}
        </option>
      ))}
    </select>
  )
}
