import { readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import { expect, test, type Page } from '@playwright/test'
import type { WorkspaceData } from '../src/models/domain'
import {
  captureBrowserDiagnostics,
  createProject,
  createStandardWorkspace,
  expectNoHorizontalOverflow,
  openWorkspaceCenter,
  waitForApp,
} from './helpers'

test.use({ timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })

// An original, deterministic abstract image: no map dataset or real geography.
function syntheticPng(): Buffer {
  const width = 160, height = 100
  const pixels = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4
      const block = Math.floor(x / 40) + Math.floor(y / 25)
      pixels[offset] = block % 2 ? 180 : 220
      pixels[offset + 1] = block % 2 ? 200 : 225
      pixels[offset + 2] = block % 2 ? 210 : 230
      pixels[offset + 3] = 255
    }
  }
  const chunk = (kind: string, data: Buffer) => {
    const content = Buffer.concat([Buffer.from(kind), data])
    let crc = 0xffffffff
    for (const byte of content) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    const result = Buffer.alloc(data.length + 12)
    result.writeUInt32BE(data.length)
    content.copy(result, 4)
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4)
    return result
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
  ])
}

const image = syntheticPng()
const pdf = Buffer.from('%PDF-1.4\nDEMO E2E map backup synthetic attachment\n%%EOF')

async function selectProject(page: Page, label: string): Promise<string> {
  const scope = page.getByRole('combobox', { name: '项目空间', exact: true })
  const [id] = await scope.selectOption({ label })
  expect(id).toBeTruthy()
  await expect(scope).toHaveValue(id!)
  return id!
}

async function goMaps(page: Page) {
  await page.goto('/#/fieldwork?view=maps')
  await waitForApp(page)
  await expect(page.getByRole('heading', { name: '本地地图标注', exact: true })).toBeVisible()
}

async function addSite(page: Page, alias: string, projectId: string) {
  await goMaps(page)
  await page.getByRole('button', { name: '添加田野点', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '添加田野点', exact: true })
  await dialog.getByLabel('田野点名称或别名').fill(alias)
  await expect(dialog.getByLabel('项目', { exact: false })).toHaveValue(projectId)
  await dialog.getByLabel('备注', { exact: true }).fill(`DEMO E2E retained ${alias} notes`)
  await dialog.getByRole('button', { name: '添加田野点', exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function importMap(page: Page, title: string, projectId: string) {
  await page.getByRole('button', { name: '导入本地地图 / 草图', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '导入本地地图 / 草图', exact: true })
  await dialog.getByLabel('地图 / 草图标题').fill(title)
  await expect(dialog.getByLabel('所属项目')).toHaveValue(projectId)
  await dialog.getByLabel('PNG / JPEG 图像', { exact: true }).setInputFiles({
    name: 'DEMO-E2E-original-sketch.png', mimeType: 'image/png', buffer: image,
  })
  await expect(dialog.getByText(/DEMO-E2E-original-sketch\.png.*160.*100/)).toBeVisible()
  await dialog.getByRole('checkbox', { name: /我有权使用此素材/ }).check()
  await dialog.getByRole('button', { name: '保存本地地图', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('group', { name: `本地地图：${title}`, exact: true })).toBeVisible()
  const mapId = await page.getByRole('combobox', { name: '本地地图', exact: true }).inputValue()
  expect(mapId).toBeTruthy()
  await expectMapImage(page, title)
  return mapId
}

async function expectMapImage(page: Page, title: string) {
  const bitmap = page.getByRole('img', { name: title, exact: true })
  await expect(bitmap).toHaveAttribute('src', `data:image/png;base64,${image.toString('base64')}`)
  await expect.poll(() => bitmap.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(160)
}

async function selectSite(page: Page, alias: string) {
  const [id] = await page.getByRole('combobox', { name: '既有田野点（同一项目）', exact: true }).selectOption({ label: alias })
  expect(id).toBeTruthy()
  await expect(page.getByRole('combobox', { name: '既有田野点（同一项目）', exact: true })).toHaveValue(id!)
  return id!
}

async function savePosition(page: Page, alias: string, x: number, y: number) {
  await page.getByLabel('水平位置（%）', { exact: true }).fill(String(x))
  await page.getByLabel('垂直位置（%）', { exact: true }).fill(String(y))
  await page.getByRole('button', { name: '保存 / 移动标注', exact: true }).click()
  const marker = page.getByRole('button', { name: `选择田野点：${alias}`, exact: true })
  await expect(marker).toBeVisible()
  await expect.poll(() => marker.evaluate((element) => ({ x: element.style.left, y: element.style.top }))).toEqual({ x: `${x}%`, y: `${y}%` })
  await expect(page.getByRole('button', { name: '保存 / 移动标注', exact: true })).toBeEnabled()
}

async function addPdf(page: Page, title: string, bytes = pdf) {
  await page.goto('/#/literature?view=all')
  await waitForApp(page)
  await page.getByRole('button', { name: '添加文献', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '添加文献', exact: true })
  await dialog.getByLabel('本地 PDF', { exact: true }).setInputFiles({ name: `${title}.pdf`, mimeType: 'application/pdf', buffer: bytes })
  await expect(dialog.getByLabel('标题', { exact: false })).toHaveValue(title)
  await dialog.getByLabel('为何阅读？', { exact: false }).fill('DEMO E2E map and PDF complete backup rationale')
  await dialog.getByRole('button', { name: '加入队列', exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function closeCenter(page: Page) {
  // A closing child is already hidden to role locators while its underlying
  // center is still inert. Wait for unregistering before inspecting it.
  await expect(page.locator('.modal-backdrop[data-closing="true"]')).toHaveCount(0)
  const center = page.getByRole('dialog', { name: '本地工作台', exact: true })
  await expect(center).toBeVisible()
  await center.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await expect(center).toBeHidden()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
  const drawer = page.getByRole('dialog', { name: '模块导航', exact: true })
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: '关闭导航', exact: true }).click()
    await expect(drawer).toBeHidden()
  }
  const more = page.getByRole('dialog', { name: '更多操作', exact: true })
  if (await more.isVisible()) {
    await page.keyboard.press('Escape')
    await expect(more).toBeHidden()
  }
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
}

async function exportJson(page: Page): Promise<WorkspaceData> {
  const center = await openWorkspaceCenter(page)
  await center.getByRole('tab', { name: '备份与恢复', exact: true }).click()
  await center.getByRole('button', { name: '导出明文 JSON', exact: true }).click()
  const warning = page.getByRole('dialog', { name: '导出可直接读取的明文？', exact: true })
  const downloadEvent = page.waitForEvent('download')
  await warning.getByRole('button', { name: '导出明文 JSON', exact: true }).click()
  const download = await downloadEvent
  const snapshot = JSON.parse(await readFile((await download.path())!, 'utf8')) as WorkspaceData
  await expect(warning).toBeHidden()
  await closeCenter(page)
  return snapshot
}

function expectImageBytes(snapshot: WorkspaceData, title: string, projectId: string, siteId: string, x: number, y: number) {
  const map = snapshot.fieldMaps.find((item) => item.title === title)
  expect(map).toBeTruthy()
  expect(map).toMatchObject({ projectId, markers: [{ fieldSiteId: siteId, x, y }] })
  expect(map!.image).toEqual({ fileName: 'DEMO-E2E-original-sketch.png', mimeType: 'image/png', size: image.length, width: 160, height: 100, base64: image.toString('base64') })
}

test('local sketch markers, linked records, project isolation and complete JSON/PDF backup persist offline', async ({ page, context }, testInfo) => {
  testInfo.setTimeout(180_000)
  const diagnostics = captureBrowserDiagnostics(page)
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (/^https?:/.test(url) && new URL(url).origin !== new URL(testInfo.project.use.baseURL!).origin) externalRequests.push(url)
  })
  await page.goto('/')
  await waitForApp(page)
  await createStandardWorkspace(page, 'DEMO E2E local sketch workspace')
  await createProject(page, 'DEMO E2E sketch project A')
  await createProject(page, 'DEMO E2E sketch project B')
  const projectB = await selectProject(page, 'DEMO E2E sketch project B')
  await addSite(page, 'DEMO E2E anonymous site B', projectB)
  await importMap(page, 'DEMO E2E abstract sketch B', projectB)
  const siteB = await selectSite(page, 'DEMO E2E anonymous site B')
  await savePosition(page, 'DEMO E2E anonymous site B', 70, 30)

  const projectA = await selectProject(page, 'DEMO E2E sketch project A')
  await expect(page.getByRole('img', { name: 'DEMO E2E abstract sketch B', exact: true })).toBeHidden()
  await addSite(page, 'DEMO E2E anonymous site A', projectA)
  await importMap(page, 'DEMO E2E abstract sketch A', projectA)
  const siteA = await selectSite(page, 'DEMO E2E anonymous site A')
  await expect(page.getByRole('combobox', { name: '既有田野点（同一项目）', exact: true }).getByRole('option', { name: 'DEMO E2E anonymous site B', exact: true })).toHaveCount(0)
  const board = page.getByTestId('field-map-board')
  const box = (await board.boundingBox())!
  if (testInfo.project.name === 'narrow-chromium') await board.tap({ position: { x: box.width * 0.25, y: box.height * 0.75 } })
  else await board.click({ position: { x: box.width * 0.25, y: box.height * 0.75 } })
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('25')
  await expect(page.getByLabel('垂直位置（%）')).toHaveValue('75')
  await expect(page.getByRole('button', { name: '选择田野点：DEMO E2E anonymous site A', exact: true })).toHaveCount(0)
  await board.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowUp')
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('26')
  await expect(page.getByLabel('垂直位置（%）')).toHaveValue('74')
  await savePosition(page, 'DEMO E2E anonymous site A', 26, 74)
  await page.reload()
  await waitForApp(page)
  await expectMapImage(page, 'DEMO E2E abstract sketch A')
  await page.getByRole('button', { name: '选择田野点：DEMO E2E anonymous site A', exact: true }).click()
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('26')
  await expect(page.getByLabel('垂直位置（%）')).toHaveValue('74')
  await page.getByRole('button', { name: '添加关联访问', exact: true }).click()
  const visit = page.getByRole('dialog', { name: '添加田野访问', exact: true })
  await expect(visit.getByLabel('项目')).toHaveValue(projectA)
  await expect(visit.getByLabel('田野点')).toHaveValue(siteA)
  await visit.getByLabel('日期', { exact: false }).fill('2026-10-03')
  await visit.getByLabel('访问目的').fill('DEMO E2E linked synthetic visit')
  await visit.getByLabel('观察内容').fill('DEMO E2E retained observation')
  await visit.getByLabel('分析备忘录').fill('DEMO E2E retained visit memo')
  await visit.getByRole('button', { name: '添加访问', exact: true }).click()
  await expect(visit).toBeHidden()
  await expect(page.getByText(/DEMO E2E linked synthetic visit/)).toBeVisible()
  await page.getByRole('button', { name: '添加关联访谈', exact: true }).click()
  const interview = page.getByRole('dialog', { name: '添加访谈', exact: true })
  await expect(interview.getByLabel('项目')).toHaveValue(projectA)
  await expect(interview.getByLabel('田野点')).toHaveValue(siteA)
  await interview.getByLabel('参与者别名').fill('DEMO E2E anonymous interview A')
  await interview.getByLabel('访谈日期').fill('2026-10-04')
  await interview.getByLabel('备注').fill('DEMO E2E retained synthetic interview notes')
  await interview.getByRole('button', { name: '添加访谈', exact: true }).click()
  await expect(interview).toBeHidden()
  await expect(page.getByText(/DEMO E2E anonymous interview A/)).toBeVisible()
  await addPdf(page, 'DEMO-E2E-sketch-source')
  await goMaps(page)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  try {
    await page.reload()
    await waitForApp(page)
    await expectMapImage(page, 'DEMO E2E abstract sketch A')
    await page.getByRole('button', { name: '选择田野点：DEMO E2E anonymous site A', exact: true }).click()
    await savePosition(page, 'DEMO E2E anonymous site A', 27, 73)
    await page.reload()
    await waitForApp(page)
    await page.getByRole('button', { name: '选择田野点：DEMO E2E anonymous site A', exact: true }).click()
    await expect(page.getByLabel('水平位置（%）')).toHaveValue('27')
    await expect(page.getByLabel('垂直位置（%）')).toHaveValue('73')
    await expectNoHorizontalOverflow(page)
    await testInfo.attach('synthetic-local-map-offline', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  } finally { await context.setOffline(false) }

  await selectProject(page, 'DEMO E2E sketch project B')
  await page.reload()
  await waitForApp(page)
  await expectMapImage(page, 'DEMO E2E abstract sketch B')
  await page.getByRole('button', { name: '选择田野点：DEMO E2E anonymous site B', exact: true }).click()
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('70')
  await expect(page.getByLabel('垂直位置（%）')).toHaveValue('30')
  await savePosition(page, 'DEMO E2E anonymous site B', 71, 31)
  const snapshot = await exportJson(page)
  expect(snapshot.version).toBe(7)
  expect(snapshot.projects).toHaveLength(2)
  expect(snapshot.fieldSites).toHaveLength(2)
  expect(snapshot.fieldMaps).toHaveLength(2)
  expectImageBytes(snapshot, 'DEMO E2E abstract sketch A', projectA, siteA, 0.27, 0.73)
  expectImageBytes(snapshot, 'DEMO E2E abstract sketch B', projectB, siteB, 0.71, 0.31)
  expect(snapshot.fieldVisits).toHaveLength(1)
  expect(snapshot.fieldVisits[0]).toMatchObject({ projectId: projectA, fieldSiteId: siteA, purpose: 'DEMO E2E linked synthetic visit', observations: 'DEMO E2E retained observation', memo: 'DEMO E2E retained visit memo' })
  expect(snapshot.interviews).toHaveLength(1)
  expect(snapshot.interviews[0]).toMatchObject({ projectId: projectA, fieldSiteId: siteA, participantAlias: 'DEMO E2E anonymous interview A', notes: 'DEMO E2E retained synthetic interview notes' })
  expect(snapshot.literature).toHaveLength(1)
  expect(snapshot.literature[0]).toMatchObject({ projectId: projectA, localPdf: { fileName: 'DEMO-E2E-sketch-source.pdf', size: pdf.length, base64: pdf.toString('base64') } })
  await selectProject(page, 'DEMO E2E sketch project A')
  await page.reload()
  await waitForApp(page)
  await expectMapImage(page, 'DEMO E2E abstract sketch A')
  await expectNoHorizontalOverflow(page)
  await testInfo.attach('synthetic-local-map-online', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  expect(externalRequests).toEqual([])
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})

test('encrypted local map lock/unlock and authenticated restore retain the exact image and markers', async ({ page }, testInfo) => {
  testInfo.setTimeout(180_000)
  const diagnostics = captureBrowserDiagnostics(page)
  const workspacePassphrase = 'DEMO E2E synthetic map workspace passphrase'
  const backupPassphrase = 'DEMO E2E synthetic map backup passphrase'
  const restoredPassphrase = 'DEMO E2E synthetic map restored passphrase'
  await page.goto('/')
  await waitForApp(page)
  let center = await openWorkspaceCenter(page)
  await center.getByRole('button', { name: '新建工作台', exact: true }).click()
  const create = page.getByRole('dialog', { name: '创建本地工作台', exact: true })
  await create.getByLabel('工作台名称').fill('DEMO E2E encrypted local map workspace')
  await create.getByRole('radio', { name: /加密本地工作台/ }).check()
  await create.getByLabel('口令', { exact: true }).fill(workspacePassphrase)
  await create.getByLabel('再次输入口令').fill(workspacePassphrase)
  await create.getByRole('checkbox', { name: /无法恢复遗失的口令/ }).check()
  await create.getByRole('button', { name: '创建工作台', exact: true }).click()
  await expect(create).toBeHidden()
  await waitForApp(page)
  await createProject(page, 'DEMO E2E encrypted map project')
  const projectId = await selectProject(page, 'DEMO E2E encrypted map project')
  await addSite(page, 'DEMO E2E encrypted anonymous site', projectId)
  await importMap(page, 'DEMO E2E encrypted abstract sketch', projectId)
  const siteId = await selectSite(page, 'DEMO E2E encrypted anonymous site')
  await savePosition(page, 'DEMO E2E encrypted anonymous site', 37, 62)
  await page.getByRole('button', { name: '锁定此工作台', exact: true }).click()
  await expect(page.getByRole('heading', { name: '加密工作台已锁定', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'DEMO E2E encrypted abstract sketch', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: '加密工作台已锁定', exact: true })).toBeVisible()
  await page.getByLabel('工作台口令', { exact: true }).fill(workspacePassphrase)
  await page.getByRole('button', { name: '解锁工作台', exact: true }).click()
  await waitForApp(page)
  await goMaps(page)
  await expectMapImage(page, 'DEMO E2E encrypted abstract sketch')
  await page.getByRole('button', { name: '选择田野点：DEMO E2E encrypted anonymous site', exact: true }).click()
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('37')
  await expect(page.getByLabel('垂直位置（%）')).toHaveValue('62')

  center = await openWorkspaceCenter(page)
  await center.getByRole('tab', { name: '备份与恢复', exact: true }).click()
  await center.getByRole('button', { name: '导出加密备份', exact: true }).click()
  const exportDialog = page.getByRole('dialog', { name: '创建加密备份', exact: true })
  await exportDialog.getByLabel('备份口令', { exact: true }).fill(backupPassphrase)
  await exportDialog.getByLabel('再次输入备份口令', { exact: true }).fill(backupPassphrase)
  const downloadEvent = page.waitForEvent('download')
  await exportDialog.getByRole('button', { name: '生成加密备份', exact: true }).click()
  const backup = await downloadEvent
  const backupPath = (await backup.path())!
  const wrapper = await readFile(backupPath, 'utf8')
  expect(Object.keys(JSON.parse(wrapper)).sort()).toEqual(['ciphertext', 'iv', 'protected'])
  expect(wrapper).not.toContain(image.toString('base64'))
  expect(wrapper).not.toContain('DEMO E2E encrypted abstract sketch')
  expect(wrapper).not.toContain('DEMO E2E encrypted anonymous site')
  expect(wrapper).not.toContain(backupPassphrase)
  await expect(exportDialog).toBeHidden()
  await center.getByRole('button', { name: '导入加密备份', exact: true }).click()
  const restore = page.getByRole('dialog', { name: '把加密备份恢复到新工作台', exact: true })
  await restore.getByLabel('加密 .sociologydesk 文件', { exact: true }).setInputFiles(backupPath)
  await restore.getByLabel('备份口令', { exact: true }).fill(backupPassphrase)
  await restore.getByLabel('新工作台口令', { exact: true }).fill(restoredPassphrase)
  await restore.getByLabel('再次输入新工作台口令', { exact: true }).fill(restoredPassphrase)
  await restore.getByRole('checkbox', { name: /无法恢复新工作台口令/ }).check()
  await restore.getByRole('button', { name: '检查导入预检', exact: true }).click()
  await expect(restore.getByText('未写入', { exact: true })).toBeVisible()
  await restore.getByRole('button', { name: '恢复到新工作台', exact: true }).click()
  await expect(restore).toBeHidden()
  await expect(center).toBeHidden()
  await waitForApp(page)
  await page.getByRole('button', { name: '锁定此工作台', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: '加密工作台已锁定', exact: true })).toBeVisible()
  await page.getByLabel('工作台口令', { exact: true }).fill(restoredPassphrase)
  await page.getByRole('button', { name: '解锁工作台', exact: true }).click()
  await waitForApp(page)
  await goMaps(page)
  await expectMapImage(page, 'DEMO E2E encrypted abstract sketch')
  await page.getByRole('button', { name: '选择田野点：DEMO E2E encrypted anonymous site', exact: true }).click()
  await expect(page.getByLabel('水平位置（%）')).toHaveValue('37')
  await expect(page.getByLabel('垂直位置（%）')).toHaveValue('62')
  const restored = await exportJson(page)
  expect(restored.version).toBe(7)
  expect(restored.fieldMaps).toHaveLength(1)
  expect(restored.fieldSites).toHaveLength(1)
  expectImageBytes(restored, 'DEMO E2E encrypted abstract sketch', projectId, siteId, 0.37, 0.62)
  expect(restored.fieldSites[0]).toMatchObject({ id: siteId, projectId, nameOrAlias: 'DEMO E2E encrypted anonymous site', notes: 'DEMO E2E retained DEMO E2E encrypted anonymous site notes' })
  await expectNoHorizontalOverflow(page)
  await testInfo.attach('synthetic-encrypted-local-map-restored', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})

test('an open workspace refreshes deadlines and preserves an unsaved task at local midnight', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000)
  const diagnostics = captureBrowserDiagnostics(page)
  await page.clock.install({ time: new Date('2026-10-03T04:00:00.000Z') })
  await page.goto('/')
  await waitForApp(page)
  await createStandardWorkspace(page, 'DEMO E2E midnight workspace')
  await createProject(page, 'DEMO E2E midnight project')
  await selectProject(page, 'DEMO E2E midnight project')
  await page.goto('/#/?view=tasks')
  await waitForApp(page)
  for (const title of ['DEMO E2E midnight pending', 'DEMO E2E midnight done']) {
    await page.getByRole('button', { name: '添加研究任务', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '添加研究任务', exact: true })
    await dialog.getByLabel('任务', { exact: false }).fill(title)
    await expect(dialog.getByLabel('截止日期', { exact: true })).toHaveValue('2026-10-03')
    await dialog.getByLabel('备注', { exact: true }).fill('DEMO E2E unchanged saved task notes')
    await dialog.getByRole('button', { name: '添加任务', exact: true }).click()
    await expect(dialog).toBeHidden()
  }
  const doneRow = page.getByRole('button', { name: /^DEMO E2E midnight done/ })
  await doneRow.click()
  await expect(doneRow).toHaveClass(/check-row--done/)
  await page.getByRole('button', { name: '查看与编辑任务：DEMO E2E midnight pending', exact: true }).click()
  const edit = page.getByRole('dialog', { name: '查看与编辑任务', exact: true })
  await edit.getByLabel('备注', { exact: true }).fill('DEMO E2E preserved unsaved midnight notes')
  // Pause only after fixture interaction, so native zero-delay modal cleanup
  // is not frozen during setup. No navigation or data write crosses midnight.
  await page.clock.pauseAt(new Date('2026-10-03T15:59:31.000Z'))
  await expect(page.locator('.page-header .eyebrow')).toContainText('10月3日')
  await page.clock.runFor(29_000)
  await expect(page.locator('.page-header .eyebrow')).toContainText('10月4日')
  await expect(page.locator('.task-deadline-summary')).toHaveText('今天到期 0 项，未来 7 天到期 0 项，已逾期 1 项。')
  await expect(edit.getByLabel('备注', { exact: true })).toHaveValue('DEMO E2E preserved unsaved midnight notes')
  await expect(edit.getByLabel('截止日期', { exact: true })).toHaveValue('2026-10-03')
  await page.clock.resume()
  await edit.getByRole('button', { name: '取消', exact: true }).click()
  await expect(doneRow).toHaveClass(/check-row--done/)
  await expect(page.getByText('已逾期 1 天', { exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: '添加研究任务', exact: true }).click()
  const newTask = page.getByRole('dialog', { name: '添加研究任务', exact: true })
  await expect(newTask.getByLabel('截止日期', { exact: true })).toHaveValue('2026-10-04')
  await newTask.getByRole('button', { name: '取消', exact: true }).click()
  await page.clock.setSystemTime(new Date('2026-10-05T00:00:00.000Z'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.page-header .eyebrow')).toContainText('10月5日')
  await expect(page.getByText('已逾期 2 天', { exact: true })).toHaveCount(1)
  const snapshot = await exportJson(page)
  expect(snapshot.tasks.map((task) => ({ title: task.title, status: task.status, dueDate: task.dueDate, notes: task.notes }))).toEqual(expect.arrayContaining([
    { title: 'DEMO E2E midnight pending', status: 'To Do', dueDate: '2026-10-03', notes: 'DEMO E2E unchanged saved task notes' },
    { title: 'DEMO E2E midnight done', status: 'Done', dueDate: '2026-10-03', notes: 'DEMO E2E unchanged saved task notes' },
  ]))
  expect(snapshot.tasks).toHaveLength(2)
  await expectNoHorizontalOverflow(page)
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})

test('a synthetic PDF at the new 10 MiB file limit downloads exact bytes before and after reload', async ({ page }, testInfo) => {
  testInfo.setTimeout(180_000)
  const diagnostics = captureBrowserDiagnostics(page)
  const maximumPdf = Buffer.alloc(10 * 1024 * 1024, 32)
  Buffer.from('%PDF-1.4\nDEMO E2E synthetic maximum-size fixture\n').copy(maximumPdf)
  Buffer.from('\n%%EOF').copy(maximumPdf, maximumPdf.length - 6)
  await page.goto('/')
  await waitForApp(page)
  await createStandardWorkspace(page, 'DEMO E2E maximum PDF workspace')
  await createProject(page, 'DEMO E2E maximum PDF project')
  const projectId = await selectProject(page, 'DEMO E2E maximum PDF project')
  await addPdf(page, 'DEMO-E2E-maximum-10-MiB', maximumPdf)
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) {
      await page.reload()
      await waitForApp(page)
    }
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('link', { name: '下载 DEMO-E2E-maximum-10-MiB.pdf', exact: true }).click()
    const downloaded = await readFile((await (await downloadEvent).path())!)
    expect(downloaded.length).toBe(10 * 1024 * 1024)
    expect(downloaded).toEqual(maximumPdf)
  }
  const snapshot = await exportJson(page)
  expect(snapshot.version).toBe(7)
  expect(snapshot.literature).toHaveLength(1)
  expect(snapshot.literature[0]).toMatchObject({ projectId, localPdf: { fileName: 'DEMO-E2E-maximum-10-MiB.pdf', size: maximumPdf.length, base64: maximumPdf.toString('base64') } })
  await expectNoHorizontalOverflow(page)
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})
