export const todayIso = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const makeId = (prefix: string) => {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}_${random}`
}

export const nowIso = () => new Date().toISOString()

export const entityMeta = (prefix: string) => {
  const timestamp = nowIso()
  return { id: makeId(prefix), createdAt: timestamp, updatedAt: timestamp, isDemo: false }
}

export const daysUntil = (value?: string) => {
  if (!value) return null
  const target = new Date(`${value.slice(0, 10)}T00:00:00`).getTime()
  const today = new Date(`${todayIso()}T00:00:00`).getTime()
  return Math.ceil((target - today) / 86_400_000)
}

export const truncate = (value: string, length = 120) =>
  value.length > length ? `${value.slice(0, length).trim()}…` : value

export const isOverdue = (dueDate?: string, status?: string) =>
  Boolean(dueDate && dueDate < todayIso() && status !== 'Done')

export const projectLabel = (
  projects: Array<{ id: string; title: string; shortTitle?: string }>,
  projectId?: string,
) => {
  const project = projects.find((item) => item.id === projectId)
  return project?.shortTitle || project?.title || 'Unassigned'
}

export const downloadTextFile = (contents: string, filename: string) => {
  const blob = new Blob([contents], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
