import { useState, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../../i18n/settings'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { ProjectScopeContext } from '../../app/project-scope-context'
import { createDemoWorkspace } from '../../models/demo'
import type { FieldMapImage, WorkspaceData } from '../../models/domain'
import { LocalFieldMaps } from './LocalFieldMaps'
import { FieldworkPage } from './FieldworkPage'
import * as imageReader from './local-field-map'
import { WorkspaceCapacityError } from '../../utils/workspace-capacity'

const image: FieldMapImage = { fileName: 'SYNTHETIC.png', mimeType: 'image/png', size: 68, width: 1, height: 1, base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=' }
const meta = { createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:00:00Z', isDemo: false }
function seed(): WorkspaceData {
  const data = createDemoWorkspace(new Date('2026-10-04T00:00:00Z'))
  const project = data.projects[0]!
  return {
    ...data,
    workspace: { ...data.workspace, activeProjectId: project.id },
    projects: [project, { ...project, id: 'SYNTHETIC-other-project', title: 'SYNTHETIC other project' }],
    fieldSites: [
      { ...meta, id: 'site-a', projectId: project.id, nameOrAlias: 'SYNTHETIC site A', status: 'Active', notes: '' },
      { ...meta, id: 'site-c', projectId: project.id, nameOrAlias: 'SYNTHETIC site C', status: 'Planned', notes: '' },
      { ...meta, id: 'site-b', projectId: 'SYNTHETIC-other-project', nameOrAlias: 'SYNTHETIC other site', status: 'Planned', notes: '' },
    ],
    fieldMaps: [
      { ...meta, id: 'map-a', projectId: project.id, title: 'SYNTHETIC map A', image, markers: [{ fieldSiteId: 'site-a', x: .25, y: .75 }] },
      { ...meta, id: 'map-b', projectId: 'SYNTHETIC-other-project', title: 'SYNTHETIC other map', image, markers: [{ fieldSiteId: 'site-b', x: .8, y: .2 }] },
    ],
    fieldVisits: [{ ...meta, id: 'visit-a', projectId: project.id, fieldSiteId: 'site-a', date: '2026-10-04', purpose: 'SYNTHETIC linked visit', observations: '', followUp: '', memo: '' }],
    interviews: [{ ...meta, id: 'interview-a', projectId: project.id, fieldSiteId: 'site-a', participantAlias: 'SYNTHETIC linked interview', status: 'Planned', transcriptStatus: 'Not Started', codingStatus: 'Not Started', memoStatus: 'Not Started', notes: '' }],
  }
}
function mount({ fail = false, page = false, initial = seed(), locale = 'zh-CN', route = '/fieldwork?view=field&tab=sites' }: { fail?: boolean | Error; page?: boolean; initial?: WorkspaceData; locale?: string; route?: string } = {}) {
  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: locale }))
  let snapshot = initial
  const edit = vi.fn(), visit = vi.fn(), interview = vi.fn(), update = vi.fn()
  let changeScope: (projectId: string) => void = () => undefined
  function ScopeHarness({ children }: { children: ReactNode }) {
    const [projectId, setProjectId] = useState('')
    changeScope = setProjectId
    return <ProjectScopeContext.Provider value={{ projectId, enter: vi.fn() }}>{children}</ProjectScopeContext.Provider>
  }
  function Harness({ children }: { children?: ReactNode }) {
    const [data, setData] = useState(initial)
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => {
      update()
      if (fail) throw fail instanceof Error ? fail : new Error('SYNTHETIC storage failure')
      setData((current) => { snapshot = updater(current); return snapshot })
    }
    const value: WorkspaceContextValue = { data, loading: false, saving: false, error: null, updateData, setActiveProject: vi.fn(), replaceWith: vi.fn(), mergeWith: vi.fn() as WorkspaceContextValue['mergeWith'], resetDemo: vi.fn(), refresh: vi.fn(), clearError: vi.fn() }
    return <WorkspaceContext.Provider value={value}>{children || <LocalFieldMaps data={data} updateData={updateData} onEditSite={edit} onCreateVisit={visit} onCreateInterview={interview} />}</WorkspaceContext.Provider>
  }
  render(<I18nProvider><ScopeHarness><MemoryRouter initialEntries={[route]}><Harness>{page ? <FieldworkPage /> : undefined}</Harness></MemoryRouter></ScopeHarness></I18nProvider>)
  return { snapshot: () => snapshot, update, edit, visit, interview, changeScope: (id: string) => changeScope(id) }
}
const selectSite = async (user: ReturnType<typeof userEvent.setup>, id = 'site-a') => user.selectOptions(screen.getByLabelText('既有田野点（同一项目）'), id)
beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('LocalFieldMaps', () => {
  it('filters sites by the map project and links only the selected site’s visits and interviews', async () => {
    const user = userEvent.setup()
    const result = mount()
    expect(within(screen.getByLabelText('既有田野点（同一项目）')).queryByRole('option', { name: 'SYNTHETIC other site' })).not.toBeInTheDocument()
    await selectSite(user)
    expect(screen.getByText(/SYNTHETIC linked visit/)).toBeInTheDocument()
    expect(screen.getByText(/SYNTHETIC linked interview/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '编辑田野点' }))
    await user.click(screen.getByRole('button', { name: '添加关联访问' }))
    await user.click(screen.getByRole('button', { name: '添加关联访谈' }))
    expect(result.edit).toHaveBeenCalledWith(result.snapshot().fieldSites[0])
    expect(result.visit).toHaveBeenCalledWith(result.snapshot().fieldSites[0])
    expect(result.interview).toHaveBeenCalledWith(result.snapshot().fieldSites[0])
    expect(result.update).not.toHaveBeenCalled()
  })
  it('calculates phone clicks in rendered coordinates and replaces one marker while retaining other projects', async () => {
    const user = userEvent.setup()
    const result = mount()
    const other = result.snapshot().fieldMaps[1]
    await selectSite(user)
    const board = screen.getByTestId('field-map-board')
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 100, width: 300, height: 200 } as DOMRect)
    fireEvent.click(board, { clientX: 170, clientY: 150 })
    expect(screen.getByLabelText('水平位置（%）')).toHaveValue(50)
    expect(screen.getByLabelText('垂直位置（%）')).toHaveValue(25)
    fireEvent.keyDown(board, { key: 'ArrowRight' })
    await user.click(screen.getByRole('button', { name: '保存 / 移动标注' }))
    await waitFor(() => expect(result.snapshot().fieldMaps[0]!.markers).toEqual([{ fieldSiteId: 'site-a', x: .51, y: .25 }]))
    expect(result.snapshot().fieldMaps[1]).toEqual(other)
    expect(result.snapshot().fieldSites).toEqual(seed().fieldSites)
  })
  it('selecting a marker does not move or save it', async () => {
    const user = userEvent.setup()
    const result = mount()
    await user.click(screen.getByRole('button', { name: '选择田野点：SYNTHETIC site A' }))
    expect(screen.getByLabelText('水平位置（%）')).toHaveValue(25)
    expect(screen.getByLabelText('垂直位置（%）')).toHaveValue(75)
    expect(result.update).not.toHaveBeenCalled()
  })
  it('retains unsaved percentages and original records after persistence fails', async () => {
    const user = userEvent.setup()
    const result = mount({ fail: true })
    await selectSite(user)
    fireEvent.change(screen.getByLabelText('水平位置（%）'), { target: { value: '70' } })
    fireEvent.change(screen.getByLabelText('垂直位置（%）'), { target: { value: '30' } })
    await user.click(screen.getByRole('button', { name: '保存 / 移动标注' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('更改未能保存')
    expect(screen.getByLabelText('水平位置（%）')).toHaveValue(70)
    expect(result.snapshot().fieldMaps[0]!.markers[0]).toMatchObject({ x: .25, y: .75 })
  })
  it('rejects invalid position input without a write', async () => {
    const user = userEvent.setup()
    const result = mount()
    await selectSite(user)
    fireEvent.change(screen.getByLabelText('水平位置（%）'), { target: { value: '101' } })
    await user.click(screen.getByRole('button', { name: '保存 / 移动标注' }))
    expect(screen.getByRole('alert')).toHaveTextContent('0 到 100')
    expect(result.update).not.toHaveBeenCalled()
  })
  it('requires confirmation for marker and map removal, retaining field site records', async () => {
    const user = userEvent.setup()
    const result = mount()
    await selectSite(user)
    await user.click(screen.getByRole('button', { name: '移除标注' }))
    expect(result.update).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认移除' }))
    await waitFor(() => expect(result.snapshot().fieldMaps[0]!.markers).toEqual([]))
    await user.click(screen.getByRole('button', { name: '删除本地地图' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认移除' }))
    await waitFor(() => expect(result.snapshot().fieldMaps.map((map) => map.id)).toEqual(['map-b']))
    expect(result.snapshot().fieldSites).toEqual(seed().fieldSites)
    expect(result.snapshot().fieldVisits).toEqual(seed().fieldVisits)
  })
  it('keeps the original image and markers when editing details; failed saves keep the form', async () => {
    const user = userEvent.setup()
    const result = mount({ fail: true })
    await user.click(screen.getByRole('button', { name: '编辑地图信息' }))
    const dialog = screen.getByRole('dialog')
    await user.clear(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' }))
    await user.type(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' }), 'SYNTHETIC edited title')
    await user.click(within(dialog).getByRole('checkbox', { name: /我有权使用/ }))
    await user.click(within(dialog).getByRole('button', { name: '保存本地地图' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('更改未能保存')
    expect(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' })).toHaveValue('SYNTHETIC edited title')
    expect(result.snapshot().fieldMaps[0]).toEqual(seed().fieldMaps[0])
  })
  it('requires explicit clearing of markers when replacing an image, preserving linked records', async () => {
    const user = userEvent.setup()
    const result = mount()
    vi.spyOn(imageReader, 'readLocalFieldMapImage').mockResolvedValue({ ...image, fileName: 'SYNTHETIC replacement.png' })
    await user.click(screen.getByRole('button', { name: '编辑地图信息' }))
    const dialog = screen.getByRole('dialog')
    await user.upload(within(dialog).getByLabelText('PNG / JPEG 图像'), new File(['SYNTHETIC'], 'replacement.png', { type: 'image/png' }))
    await within(dialog).findByRole('checkbox', { name: /确认更换底图/ })
    await user.click(within(dialog).getByRole('checkbox', { name: /我有权使用/ }))
    await user.click(within(dialog).getByRole('button', { name: '保存本地地图' }))
    expect(result.update).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', { name: /确认更换底图/ }))
    await user.click(within(dialog).getByRole('button', { name: '保存本地地图' }))
    await waitFor(() => expect(result.snapshot().fieldMaps[0]!.markers).toEqual([]))
    expect(result.snapshot().fieldMaps[0]!.image.fileName).toBe('SYNTHETIC replacement.png')
    expect(result.snapshot().fieldSites).toEqual(seed().fieldSites)
  })
  it('rejects SVG input and keeps the previously saved map and entered title', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const result = mount()
    await user.click(screen.getByRole('button', { name: '编辑地图信息' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' }), ' draft')
    await user.upload(within(dialog).getByLabelText('PNG / JPEG 图像'), new File(['<svg>SYNTHETIC</svg>'], 'SYNTHETIC.svg', { type: 'image/svg+xml' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('原图像保持不变')
    expect(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' })).toHaveValue('SYNTHETIC map A draft')
    expect(result.snapshot().fieldMaps[0]).toEqual(seed().fieldMaps[0])
    expect(result.update).not.toHaveBeenCalled()
  })
  it('blocks deleting a field site referenced only by a map marker', async () => {
    const user = userEvent.setup()
    const initial = seed()
    initial.fieldVisits = []
    initial.interviews = []
    const result = mount({ page: true, initial })
    const row = screen.getByText('SYNTHETIC site A').closest('tr')!
    await user.click(within(row).getByRole('button', { name: '删除' }))
    expect(within(screen.getByRole('dialog')).getAllByText(/请先移除此田野点的地图标注/).length).toBeGreaterThan(0)
    expect(result.update).not.toHaveBeenCalled()
    expect(result.snapshot().fieldSites).toEqual(initial.fieldSites)
  })
  it('creates a map after explicit rights confirmation and preserves the complete workspace', async () => {
    const user = userEvent.setup()
    const result = mount()
    const before = result.snapshot()
    vi.spyOn(imageReader, 'readLocalFieldMapImage').mockResolvedValue(image)
    await user.click(screen.getByRole('button', { name: '导入本地地图 / 草图' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' }), 'SYNTHETIC new map')
    await user.upload(within(dialog).getByLabelText('PNG / JPEG 图像'), new File(['SYNTHETIC'], 'SYNTHETIC.png', { type: 'image/png' }))
    await user.click(within(dialog).getByRole('button', { name: '保存本地地图' }))
    expect(result.update).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', { name: /我有权使用/ }))
    await user.click(within(dialog).getByRole('button', { name: '保存本地地图' }))
    await waitFor(() => expect(result.snapshot().fieldMaps).toHaveLength(3))
    expect(result.snapshot().fieldMaps[0]).toMatchObject({ title: 'SYNTHETIC new map', projectId: before.workspace.activeProjectId, image, markers: [] })
    expect(result.snapshot().fieldMaps.slice(1)).toEqual(before.fieldMaps)
    expect(result.snapshot().literature).toEqual(before.literature)
    expect(result.snapshot().fieldSites).toEqual(before.fieldSites)
  })
  it('saves a title-only edit without changing the existing image or marker positions', async () => {
    const user = userEvent.setup()
    const result = mount()
    await user.click(screen.getByRole('button', { name: '编辑地图信息' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' }), ' updated')
    await user.click(within(dialog).getByRole('checkbox', { name: /我有权使用/ }))
    await user.click(within(dialog).getByRole('button', { name: '保存本地地图' }))
    await waitFor(() => expect(result.snapshot().fieldMaps[0]!.title).toBe('SYNTHETIC map A updated'))
    expect(result.snapshot().fieldMaps[0]!.image).toEqual(image)
    expect(result.snapshot().fieldMaps[0]!.markers).toEqual(seed().fieldMaps[0]!.markers)
  })
  it('keeps a failed removal confirmation open and retains all records', async () => {
    const user = userEvent.setup()
    const result = mount({ fail: true })
    await user.click(screen.getByRole('button', { name: '删除本地地图' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '确认移除' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('更改未能保存')
    expect(dialog).toBeInTheDocument()
    expect(result.snapshot()).toEqual(seed())
  })
  it('offers the English workflow without translating research titles or changing data', () => {
    const result = mount({ locale: 'en' })
    expect(screen.getByRole('heading', { name: 'Local map annotations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import local map / sketch' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Local map: SYNTHETIC map A' })).toBeInTheDocument()
    expect(result.update).not.toHaveBeenCalled()
    expect(result.snapshot().fieldMaps[0]!.title).toBe('SYNTHETIC map A')
  })
  it('rejects a stale map editor after the project scope changes rather than moving records', async () => {
    const user = userEvent.setup()
    const result = mount()
    await user.click(screen.getByRole('button', { name: '编辑地图信息' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('checkbox', { name: /我有权使用/ }))
    act(() => result.changeScope('SYNTHETIC-other-project'))
    await user.click(within(dialog).getByRole('button', { name: '保存本地地图' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('更改未能保存')
    expect(result.update).not.toHaveBeenCalled()
    expect(result.snapshot().fieldMaps).toEqual(seed().fieldMaps)
  })
  it('reuses the selected site in a visit form and retains the form after a failed save', async () => {
    const user = userEvent.setup()
    const result = mount({ page: true, fail: true, route: '/fieldwork?view=maps' })
    await selectSite(user)
    await user.click(screen.getByRole('button', { name: '添加关联访问' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('combobox', { name: '田野点' })).toHaveValue('site-a')
    await user.type(within(dialog).getByRole('textbox', { name: '访问目的' }), 'SYNTHETIC map visit')
    await user.click(within(dialog).getByRole('button', { name: '添加访问' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('更改未能保存')
    expect(within(dialog).getByRole('textbox', { name: '访问目的' })).toHaveValue('SYNTHETIC map visit')
    expect(result.snapshot().fieldVisits).toEqual(seed().fieldVisits)
  })
  it('explains the complete 32 MiB backup limit and retains the map draft when the global budget rejects it', async () => {
    const user = userEvent.setup()
    const result = mount({ fail: new WorkspaceCapacityError() })
    await user.click(screen.getByRole('button', { name: '编辑地图信息' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' }), ' capacity draft')
    await user.click(within(dialog).getByRole('checkbox', { name: /我有权使用/ }))
    await user.click(within(dialog).getByRole('button', { name: '保存本地地图' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('完整备份将超过 32 MiB 恢复上限')
    expect(within(dialog).getByRole('textbox', { name: '地图 / 草图标题' })).toHaveValue('SYNTHETIC map A capacity draft')
    expect(result.snapshot().fieldMaps).toEqual(seed().fieldMaps)
  })
})
