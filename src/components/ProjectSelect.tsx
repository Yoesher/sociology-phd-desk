import type { ResearchProject } from '../models/domain'

export function ProjectSelect({
  projects,
  value,
  onChange,
  includeAll = false,
  allLabel = 'All projects',
  required = false,
  disabled = false,
}: {
  projects: ResearchProject[]
  value: string
  onChange: (value: string) => void
  includeAll?: boolean
  allLabel?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      disabled={disabled}
    >
      {includeAll ? (
        <option value="">{allLabel}</option>
      ) : (
        <option value="">{required ? 'Select a project' : 'Unassigned'}</option>
      )}
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.shortTitle || project.title}
        </option>
      ))}
    </select>
  )
}
