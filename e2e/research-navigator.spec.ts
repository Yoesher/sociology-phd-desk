import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import type { WorkspaceData } from '../src/models/domain'
import {
  captureBrowserDiagnostics,
  createProject,
  createStandardWorkspace,
  expectNoHorizontalOverflow,
  openWorkspaceCenter,
  waitForApp,
} from './helpers'

test.use({ reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' })
test.setTimeout(120_000)

const navigatorTitle = /^(研究导航|Research navigator)$/
const queryLabel = /^(检索研究记录|Search research records)$/
const recordKinds = [
  'project', 'question', 'claim', 'theory', 'task', 'literature', 'site', 'map',
  'interview', 'visit', 'dataset', 'analysis', 'evidence', 'log', 'manuscript',
  'submission', 'review',
]

function literal(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
}

async function closeChromeMenus(page: Page) {
  const drawer = page.getByRole('dialog', { name: /^(模块导航|Navigate)$/ })
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: /^(关闭导航|Close navigation)$/ }).click()
    await expect(drawer).toBeHidden()
  }
  const more = page.getByRole('dialog', { name: /^(更多操作|More actions)$/ })
  if (await more.isVisible()) {
    await page.keyboard.press('Escape')
    await expect(more).toBeHidden()
  }
  await expect(page.locator('.mobile-menu-backdrop, .topbar-more__menu')).toHaveCount(0)
}

async function closeCenter(page: Page, center: Locator) {
  await expect(page.locator('.modal-backdrop[data-closing]')).toHaveCount(0)
  await expect(center).toBeVisible()
  await center.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
  await closeChromeMenus(page)
}

async function exportCompleteWorkspace(page: Page): Promise<WorkspaceData> {
  const center = await openWorkspaceCenter(page)
  await center.getByRole('tab', { name: '备份与恢复', exact: true }).click()
  await center.getByRole('button', { name: '导出明文 JSON', exact: true }).click()
  const warning = page.getByRole('dialog', { name: '导出可直接读取的明文？', exact: true })
  const downloaded = page.waitForEvent('download')
  await warning.getByRole('button', { name: '导出明文 JSON', exact: true }).click()
  const download = await downloaded
  const snapshot = JSON.parse(await readFile((await download.path())!, 'utf8')) as WorkspaceData
  expect(snapshot.version).toBe(9)
  await expect(warning).toBeHidden()
  await closeCenter(page, center)
  return snapshot
}

function withoutExportTime(snapshot: WorkspaceData) {
  const { exportedAt: _exportedAt, ...content } = snapshot
  return content
}

async function selectProject(page: Page, title: string) {
  expect(title.length).toBeLessThanOrEqual(36)
  const scope = page.getByRole('combobox', { name: '项目空间', exact: true })
  const [id] = await scope.selectOption({ label: title })
  expect(id).toBeTruthy()
  await expect(scope).toHaveValue(id!)
  return id!
}

async function addTask(page: Page, title: string, notes: string) {
  await page.goto('/#/?view=tasks&filter=all')
  await waitForApp(page)
  await page.getByRole('button', { name: '添加研究任务', exact: true }).click()
  const form = page.getByRole('dialog', { name: '添加研究任务', exact: true })
  await form.getByLabel('任务', { exact: false }).fill(title)
  await form.getByLabel('截止日期', { exact: true }).fill('2099-01-12')
  await form.getByRole('textbox', { name: '备注', exact: true }).fill(notes)
  await form.getByRole('button', { name: '添加任务', exact: true }).click()
  await expect(form).toBeHidden()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
}

async function addLiterature(page: Page, title: string, rationale: string) {
  await page.goto('/#/literature?view=all')
  await waitForApp(page)
  await page.getByRole('button', { name: '添加文献', exact: true }).click()
  const form = page.getByRole('dialog', { name: '添加文献', exact: true })
  await form.getByRole('textbox', { name: /标题/ }).fill(title)
  await form.getByRole('textbox', { name: /^作者/ }).fill('DEMO E2E synthetic author')
  await form.getByRole('textbox', { name: '为何阅读？', exact: true }).fill(rationale)
  await form.getByRole('button', { name: '加入队列', exact: true }).click()
  await expect(form).toBeHidden()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
}

async function openNavigator(page: Page) {
  const dialog = page.getByRole('dialog', { name: navigatorTitle })
  await page.getByRole('button', { name: navigatorTitle }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('searchbox', { name: queryLabel })).toBeVisible()
  return dialog
}

async function closeNavigator(page: Page, dialog: Locator) {
  await dialog.getByRole('button', { name: /^(完成|Done)$/, exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
}

function resultFor(dialog: Locator, title: string) {
  return dialog.locator('.navigator-results').getByRole('button', { name: literal(title) })
}

async function changeLanguage(page: Page, language: 'en' | 'zh-CN') {
  const narrow = (page.viewportSize()?.width ?? 1280) <= 1024
  let menu: Locator
  if (narrow) {
    await page.getByRole('button', { name: /^(打开导航|Open navigation)$/ }).click()
    menu = page.getByRole('dialog', { name: /^(模块导航|Navigate)$/ })
    const settings = menu.getByRole('button', { name: /^(工作空间与设置|Workspace & Settings)$/ })
    if (await settings.getAttribute('aria-expanded') !== 'true') await settings.click()
  } else {
    await page.getByRole('button', { name: /^(更多操作|More actions)$/ }).click()
    menu = page.getByRole('dialog', { name: /^(更多操作|More actions)$/ })
  }
  await menu.getByRole('button', { name: language === 'en' ? 'English' : '简体中文', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', language)
  await closeChromeMenus(page)
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await expectNoHorizontalOverflow(page)
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

test('research navigator searches note-only records across explicit project scope without changing a complete backup', async ({ page }, testInfo) => {
  const diagnostics = captureBrowserDiagnostics(page)
  await page.goto('/')
  await waitForApp(page)
  await createStandardWorkspace(page, 'DEMO E2E NAV readonly workspace')
  const a = 'DEMO E2E NAV project A'
  const b = 'DEMO E2E NAV project B'
  const taskA = 'DEMO E2E NAV task A'
  const taskB = 'DEMO E2E NAV task B'
  const literatureA = 'DEMO E2E NAV source A'
  const query = 'DEMO_NAV_NOTE_714'
  const longNote = `${query} ${'DEMO_LONG_NOTE_'.repeat(14)}`
  await createProject(page, a)
  await createProject(page, b)
  const projectB = await selectProject(page, b)
  await addTask(page, taskB, `${query} second project retained synthetic notes`)
  const projectA = await selectProject(page, a)
  await addTask(page, taskA, longNote)
  await addLiterature(page, literatureA, `${query} first project synthetic reading rationale`)
  const before = await exportCompleteWorkspace(page)
  expect(before.projects).toHaveLength(2)
  expect(before.tasks).toHaveLength(2)
  expect(before.literature).toHaveLength(1)
  expect(before.workspace.activeProjectId).toBe(projectA)
  expect(before.tasks.find((item) => item.title === taskB)?.projectId).toBe(projectB)

  let dialog = await openNavigator(page)
  const type = dialog.getByRole('combobox', { name: '记录类型', exact: true })
  expect(await type.locator('option').evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value))).toEqual(['all', ...recordKinds])
  const allProjects = dialog.getByRole('checkbox', { name: '检索所有项目', exact: true })
  await expect(allProjects).not.toBeChecked()
  await expect(dialog.getByRole('combobox', { name: '项目', exact: true })).toHaveValue(projectA)
  await dialog.getByRole('searchbox', { name: queryLabel }).fill(query)
  await expect(resultFor(dialog, taskA)).toBeVisible()
  await expect(resultFor(dialog, literatureA)).toBeVisible()
  await expect(resultFor(dialog, taskB)).toHaveCount(0)
  await expect(dialog.getByRole('status')).toHaveText('2 条记录 · 第 1 / 1 页')
  await attachScreenshot(page, testInfo, 'DEMO-scoped-note-search')

  await allProjects.check()
  await expect(resultFor(dialog, taskB)).toBeVisible()
  await expect(dialog.getByRole('status')).toHaveText('3 条记录 · 第 1 / 1 页')
  await type.selectOption('task')
  await expect(resultFor(dialog, taskA)).toBeVisible()
  await expect(resultFor(dialog, taskB)).toBeVisible()
  await expect(resultFor(dialog, literatureA)).toHaveCount(0)
  await expect(dialog.getByRole('status')).toHaveText('2 条记录 · 第 1 / 1 页')
  await resultFor(dialog, taskA).click()
  const detail = dialog.getByRole('region', { name: '记录详情', exact: true })
  await expect(detail.getByRole('heading', { name: taskA, exact: true })).toBeVisible()
  await expect(detail).toContainText(longNote)
  await expect(detail.getByRole('link', { name: '前往原模块', exact: true })).toBeVisible()
  await attachScreenshot(page, testInfo, 'DEMO-readonly-long-note-detail')
  await dialog.getByRole('button', { name: '返回结果', exact: true }).click()
  await expect(resultFor(dialog, taskB)).toBeVisible()

  await dialog.getByRole('searchbox', { name: queryLabel }).fill('DEMO_NAV_LITERAL_[.*]+_NO_MATCH')
  await expect(dialog.locator('.navigator-results')).toHaveCount(0)
  await expect(dialog.getByRole('status')).toHaveText('0 条记录 · 第 1 / 1 页')
  expect(page.url()).not.toContain(query)
  expect(await page.evaluate((term) => Object.values(localStorage).some((value) => typeof value === 'string' && value.includes(term)), query)).toBe(false)
  await closeNavigator(page, dialog)
  const after = await exportCompleteWorkspace(page)
  expect(withoutExportTime(after)).toEqual(withoutExportTime(before))

  await page.reload()
  await waitForApp(page)
  dialog = await openNavigator(page)
  await expect(dialog.getByRole('searchbox', { name: queryLabel })).toHaveValue('')
  await expect(dialog.getByRole('checkbox', { name: '检索所有项目', exact: true })).not.toBeChecked()
  await dialog.getByRole('searchbox', { name: queryLabel }).fill(query)
  await expect(resultFor(dialog, taskA)).toBeVisible()
  await expect(resultFor(dialog, taskB)).toHaveCount(0)
  await closeNavigator(page, dialog)
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})

test('project overview counts browse records and saved question-claim-memo relationships stay read-only and bilingual', async ({ page }, testInfo) => {
  const diagnostics = captureBrowserDiagnostics(page)
  const demoName = 'Sociology PhD Desk — Demo Workspace'
  await page.goto('/')
  await waitForApp(page)
  const center = await openWorkspaceCenter(page)
  const openDemo = center.getByRole('button', { name: `打开${demoName}`, exact: true })
  if (await openDemo.isEnabled()) {
    await openDemo.click()
    await expect(center).toBeHidden()
    await expect(page.locator('.modal-backdrop')).toHaveCount(0)
    await closeChromeMenus(page)
    await waitForApp(page)
  } else {
    await closeCenter(page, center)
  }
  await expect(page.locator('.brand__copy--workspace')).toContainText(demoName)
  const scope = page.getByRole('combobox', { name: '项目空间', exact: true })
  await scope.selectOption('')
  await expect(scope).toHaveValue('')
  const before = await exportCompleteWorkspace(page)
  expect(before.projects).toHaveLength(2)
  const mainProject = before.projects.find((item) => item.id === 'demo-project-employment-mobility')!
  const theoryProject = before.projects.find((item) => item.id === 'demo-project-platform-work-theory')!
  const question = before.researchQuestions.find((item) => item.id === 'demo-question-employment-uncertainty')!
  const otherQuestion = before.researchQuestions.find((item) => item.projectId === mainProject.id)!
  const claim = before.claims.find((item) => item.id === 'demo-claim-institutional-buffering')!
  const memo = before.theoryMemos.find((item) => item.id === 'demo-theory-memo-institutional-buffering')!
  expect(before.claimQuestionLinks).toEqual(expect.arrayContaining([
    expect.objectContaining({ projectId: theoryProject.id, claimId: claim.id, researchQuestionId: question.id }),
  ]))
  expect(memo).toMatchObject({ projectId: theoryProject.id, relatedQuestionIds: [question.id], relatedClaimIds: [claim.id] })

  let dialog = await openNavigator(page)
  await expect(dialog.getByRole('checkbox', { name: '检索所有项目', exact: true })).toBeChecked()
  await dialog.getByRole('button', { name: '项目概览', exact: true }).click()
  const overview = dialog.getByRole('region', { name: '项目概览', exact: true })
  await expect(overview).toContainText('已完成任务数不代表项目完成度或研究质量')
  await expect(overview.getByRole('article')).toHaveCount(2)
  for (const project of before.projects) {
    const card = overview.getByRole('article', { name: project.title, exact: true })
    await expect(card.getByRole('heading', { name: project.title, exact: true })).toBeVisible()
    const totalTasks = before.tasks.filter((item) => item.projectId === project.id).length
    const memos = before.theoryMemos.filter((item) => item.projectId === project.id).length
    const sites = before.fieldSites.filter((item) => item.projectId === project.id).length
    await expect(card.getByRole('button', { name: /^全部任务\s/ }).locator('strong')).toHaveText(String(totalTasks))
    await expect(card.getByRole('button', { name: /^理论备忘\s/ }).locator('strong')).toHaveText(String(memos))
    await expect(card.getByRole('button', { name: /^已标注田野点 \/ 全部田野点\s/ }).locator('strong')).toHaveText(`0 / ${sites}`)
  }
  await attachScreenshot(page, testInfo, 'DEMO-project-overview-real-counts')
  const mainTasks = before.tasks.filter((item) => item.projectId === mainProject.id)
  await overview.getByRole('article', { name: mainProject.title, exact: true }).getByRole('button', { name: /^全部任务\s/ }).click()
  await expect(dialog.getByRole('searchbox', { name: queryLabel })).toHaveValue('')
  await expect(dialog.getByRole('combobox', { name: '记录类型', exact: true })).toHaveValue('task')
  await expect(dialog.getByRole('combobox', { name: '项目', exact: true })).toHaveValue(mainProject.id)
  await expect(dialog.locator('.navigator-results > li')).toHaveCount(mainTasks.length)
  for (const task of mainTasks) await expect(resultFor(dialog, task.title)).toBeVisible()
  for (const task of before.tasks.filter((item) => item.projectId !== mainProject.id)) {
    await expect(resultFor(dialog, task.title)).toHaveCount(0)
  }
  // Count navigation changes only the navigator's projection, not the shared project scope.
  await expect(scope).toHaveValue('')
  await dialog.getByRole('button', { name: '项目概览', exact: true }).click()
  await dialog.getByRole('checkbox', { name: '检索所有项目', exact: true }).check()
  await overview.getByRole('article', { name: theoryProject.title, exact: true }).getByRole('button', { name: /^理论备忘\s/ }).click()
  await expect(dialog.getByRole('combobox', { name: '记录类型', exact: true })).toHaveValue('theory')
  await expect(dialog.locator('.navigator-results > li')).toHaveCount(2)
  await expect(resultFor(dialog, memo.title)).toBeVisible()

  await dialog.getByRole('combobox', { name: '记录类型', exact: true }).selectOption('question')
  await expect(resultFor(dialog, question.text)).toBeVisible()
  await resultFor(dialog, question.text).click()
  const detail = dialog.getByRole('region', { name: '记录详情', exact: true })
  await expect(detail.getByRole('heading', { name: question.text, exact: true })).toBeFocused()
  await expect(detail.getByRole('heading', { name: '已登记关联', exact: true })).toBeVisible()
  await expect(detail.locator('.navigator-related').getByRole('button', { name: literal(otherQuestion.text) })).toHaveCount(0)
  await detail.locator('.navigator-related').getByRole('button', { name: literal(claim.text) }).click()
  await expect(detail.getByRole('heading', { name: claim.text, exact: true })).toBeFocused()
  await detail.locator('.navigator-related').getByRole('button', { name: literal(memo.title) }).click()
  await expect(detail.getByRole('heading', { name: memo.title, exact: true })).toBeFocused()
  await expect(detail).toContainText(memo.content)
  await detail.locator('.navigator-related').getByRole('button', { name: literal(question.text) }).click()
  await expect(detail.getByRole('heading', { name: question.text, exact: true })).toBeFocused()
  await attachScreenshot(page, testInfo, 'DEMO-explicit-question-claim-memo-relationships')
  await detail.getByRole('link', { name: '前往原模块', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/projects(?:\?|$)/)
  await waitForApp(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(scope).toHaveValue('')

  await changeLanguage(page, 'en')
  dialog = await openNavigator(page)
  await expect(dialog.getByRole('combobox', { name: 'Record type', exact: true })).toHaveValue('all')
  await dialog.getByRole('button', { name: 'Project overview', exact: true }).click()
  const englishOverview = dialog.getByRole('region', { name: 'Project overview', exact: true })
  await expect(englishOverview.getByRole('article')).toHaveCount(2)
  await expect(englishOverview).toContainText('Completed tasks are not a measure of project completion or research quality')
  await englishOverview.getByRole('article', { name: theoryProject.title, exact: true }).getByRole('button', { name: /^Theory memos\s/ }).click()
  await resultFor(dialog, memo.title).click()
  const englishDetail = dialog.getByRole('region', { name: 'Record details', exact: true })
  await expect(englishDetail.getByRole('heading', { name: memo.title, exact: true })).toBeVisible()
  await expect(englishDetail.getByRole('heading', { name: 'Saved relationships', exact: true })).toBeVisible()
  await expect(englishDetail.getByRole('link', { name: 'Go to original module', exact: true })).toBeVisible()
  await attachScreenshot(page, testInfo, 'DEMO-English-project-navigator')
  await closeNavigator(page, dialog)
  await changeLanguage(page, 'zh-CN')
  const after = await exportCompleteWorkspace(page)
  expect(withoutExportTime(after)).toEqual(withoutExportTime(before))
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})

test('research navigator shortcuts and encrypted lock clear transient search while preserving committed records', async ({ page }, testInfo) => {
  const diagnostics = captureBrowserDiagnostics(page)
  const passphrase = 'DEMO E2E NAV synthetic encryption passphrase'
  const project = 'DEMO E2E NAV private project'
  const taskTitle = 'DEMO E2E NAV private task'
  const query = 'DEMO_NAV_PRIVATE_QUERY_915'
  await page.goto('/')
  await waitForApp(page)
  const center = await openWorkspaceCenter(page)
  await center.getByRole('button', { name: '新建工作台', exact: true }).click()
  const create = page.getByRole('dialog', { name: '创建本地工作台', exact: true })
  await create.getByLabel('工作台名称').fill('DEMO E2E NAV encrypted workspace')
  await create.getByRole('radio', { name: /加密本地工作台/ }).check()
  await create.getByLabel('口令', { exact: true }).fill(passphrase)
  await create.getByLabel('再次输入口令', { exact: true }).fill(passphrase)
  await create.getByRole('checkbox', { name: /无法恢复遗失的口令/ }).check()
  await create.getByRole('button', { name: '创建工作台', exact: true }).click()
  await expect(create).toBeHidden()
  await waitForApp(page)
  await createProject(page, project)
  await selectProject(page, project)
  await addTask(page, taskTitle, `${query} synthetic encrypted note`)
  const before = await exportCompleteWorkspace(page)

  // Both shortcuts operate from a non-input target, including touch-emulated contexts.
  const trigger = page.getByRole('button', { name: navigatorTitle })
  await trigger.focus()
  await page.keyboard.press('Control+k')
  let dialog = page.getByRole('dialog', { name: navigatorTitle })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('searchbox', { name: queryLabel }).fill(query)
  await expect(resultFor(dialog, taskTitle)).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(dialog).toHaveCount(1)
  await expect(dialog.getByRole('searchbox', { name: queryLabel })).toHaveValue(query)
  await closeNavigator(page, dialog)
  await trigger.focus()
  await page.keyboard.press('Meta+k')
  dialog = page.getByRole('dialog', { name: navigatorTitle })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('searchbox', { name: queryLabel })).toHaveValue('')
  await closeNavigator(page, dialog)

  // An ordinary outside text input and another open form must keep their own keyboard work.
  await page.goto('/#/literature?view=all')
  await waitForApp(page)
  const literatureSearch = page.getByPlaceholder('搜索标题、作者、期刊或阅读理由', { exact: true })
  await literatureSearch.fill('DEMO_NAV_INPUT_TEXT')
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: navigatorTitle })).toHaveCount(0)
  await expect(literatureSearch).toHaveValue('DEMO_NAV_INPUT_TEXT')
  await page.goto('/#/?view=tasks&filter=all')
  await waitForApp(page)
  await page.getByRole('button', { name: '添加研究任务', exact: true }).click()
  const taskForm = page.getByRole('dialog', { name: '添加研究任务', exact: true })
  await taskForm.getByRole('textbox', { name: '备注', exact: true }).fill('DEMO_NAV_UNSAVED_INPUT')
  await page.keyboard.press('Meta+k')
  await expect(taskForm).toBeVisible()
  await expect(taskForm.getByRole('textbox', { name: '备注', exact: true })).toHaveValue('DEMO_NAV_UNSAVED_INPUT')
  await expect(page.getByRole('dialog', { name: navigatorTitle })).toHaveCount(0)
  await taskForm.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)

  dialog = await openNavigator(page)
  await dialog.getByRole('searchbox', { name: queryLabel }).fill(query)
  await resultFor(dialog, taskTitle).click()
  await expect(dialog.getByRole('region', { name: '记录详情', exact: true })).toContainText(query)
  await attachScreenshot(page, testInfo, 'DEMO-unlocked-encrypted-navigator')
  await closeNavigator(page, dialog)
  await page.getByRole('button', { name: '锁定此工作台', exact: true }).click()
  await expect(page.getByRole('heading', { name: '加密工作台已锁定', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: navigatorTitle })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: navigatorTitle })).toHaveCount(0)
  await expect(page.getByText(taskTitle, { exact: true })).toHaveCount(0)
  expect(await page.locator('body').innerText()).not.toContain(query)
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: navigatorTitle })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: '加密工作台已锁定', exact: true })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toContain(query)
  await page.getByLabel('工作台口令', { exact: true }).fill(passphrase)
  await page.getByRole('button', { name: '解锁工作台', exact: true }).click()
  await waitForApp(page)
  dialog = await openNavigator(page)
  await expect(dialog.getByRole('searchbox', { name: queryLabel })).toHaveValue('')
  await expect(dialog.getByRole('region', { name: '记录详情', exact: true })).toHaveCount(0)
  await dialog.getByRole('searchbox', { name: queryLabel }).fill(query)
  await expect(resultFor(dialog, taskTitle)).toBeVisible()
  await closeNavigator(page, dialog)
  const after = await exportCompleteWorkspace(page)
  expect(withoutExportTime(after)).toEqual(withoutExportTime(before))
  expect(after.tasks).toHaveLength(1)
  expect(after.tasks[0]).toMatchObject({ title: taskTitle, dueDate: '2099-01-12', status: 'To Do', notes: `${query} synthetic encrypted note` })
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})
