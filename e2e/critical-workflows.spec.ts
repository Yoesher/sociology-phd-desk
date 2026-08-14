import { expect, test } from '@playwright/test'
import {
  createProject,
  createStandardWorkspace,
  openWorkspaceCenter,
  syntheticPrefix,
  waitForApp,
  waitForPersistedProjectTitle,
} from './helpers'

test.describe('desktop critical research workflows', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium')
    testInfo.setTimeout(60_000)
    await page.goto('/')
    await waitForApp(page)
  })

  test('creates, edits, reloads, and deletes project, evidence, and fieldwork records', async ({ page }) => {
    const workspace = `${syntheticPrefix} CRUD workspace`
    const project = `${syntheticPrefix} project`
    const renamedProject = `${project} revised`
    const evidenceClaim = `${syntheticPrefix} provisional claim`
    const revisedClaim = `${evidenceClaim} revised`
    const fieldSite = `${syntheticPrefix} site alias`
    const revisedSite = `${fieldSite} revised`

    await createStandardWorkspace(page, workspace)
    await createProject(page, project)

    let projectRow = page.getByRole('row').filter({ hasText: project })
    await projectRow.getByRole('button', { name: '编辑' }).click()
    let dialog = page.getByRole('dialog', { name: '编辑研究项目' })
    await dialog.getByLabel('项目标题').fill(renamedProject)
    await dialog.getByRole('button', { name: '保存更改' }).click()
    await expect(page.getByRole('row').filter({ hasText: renamedProject })).toBeVisible()
    await waitForPersistedProjectTitle(page, renamedProject)

    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('row').filter({ hasText: renamedProject })).toBeVisible()

    await page.goto('/#/evidence?view=all')
    await page.getByRole('button', { name: '添加证据', exact: true }).click()
    dialog = page.getByRole('dialog', { name: '添加证据条目' })
    await dialog.getByLabel('项目').selectOption({ index: 1 })
    await dialog.getByLabel('论断').fill(evidenceClaim)
    await dialog.getByLabel('来源').fill(`${syntheticPrefix} source`)
    await dialog.getByLabel('发现').fill(`${syntheticPrefix} finding`)
    await dialog.getByRole('button', { name: '添加证据' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('heading', { name: evidenceClaim, exact: true })).toBeVisible()

    let evidenceCard = page.locator('article').filter({ hasText: evidenceClaim })
    await evidenceCard.getByRole('button', { name: '编辑' }).click()
    dialog = page.getByRole('dialog', { name: '编辑证据条目' })
    await dialog.getByLabel('论断').fill(revisedClaim)
    await dialog.getByRole('button', { name: '保存更改' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('heading', { name: revisedClaim, exact: true })).toBeVisible()

    await page.goto('/#/projects?view=all')
    projectRow = page.getByRole('row').filter({ hasText: renamedProject })
    await projectRow.getByRole('button', { name: '删除' }).click()
    dialog = page.getByRole('dialog', { name: '项目仍有关联研究记录' })
    await expect(dialog).toContainText('1 条关联记录')
    await dialog.getByRole('button', { name: '保留项目' }).click()
    await expect(projectRow).toBeVisible()

    await page.goto('/#/evidence?view=all')
    evidenceCard = page.locator('article').filter({ hasText: revisedClaim })
    await evidenceCard.getByRole('button', { name: '删除' }).click()
    dialog = page.getByRole('dialog', { name: '删除这项证据？' })
    await dialog.getByRole('button', { name: '删除证据' }).click()
    await expect(page.getByText(revisedClaim, { exact: true })).toHaveCount(0)

    await page.goto('/#/fieldwork?view=overview')
    await page.getByRole('button', { name: '添加田野点' }).first().click()
    dialog = page.getByRole('dialog', { name: '添加田野点' })
    await dialog.getByLabel('田野点名称或别名').fill(fieldSite)
    await dialog.getByLabel('项目').selectOption({ index: 1 })
    await dialog.getByRole('button', { name: '添加田野点' }).click()
    await expect(page.getByText(fieldSite, { exact: true })).toBeVisible()

    let siteRow = page.getByRole('row').filter({ hasText: fieldSite })
    await siteRow.getByRole('button', { name: '编辑' }).click()
    dialog = page.getByRole('dialog', { name: '编辑田野点' })
    await dialog.getByLabel('田野点名称或别名').fill(revisedSite)
    await dialog.getByRole('button', { name: '保存更改' }).click()
    await expect(page.getByRole('row').filter({ hasText: revisedSite })).toBeVisible()

    siteRow = page.getByRole('row').filter({ hasText: revisedSite })
    await siteRow.getByRole('button', { name: '删除' }).click()
    dialog = page.getByRole('dialog', { name: new RegExp(revisedSite) })
    await dialog.getByRole('button', { name: '删除记录' }).click()
    await expect(page.getByText(revisedSite, { exact: true })).toHaveCount(0)

    await page.goto('/#/projects?view=all')
    projectRow = page.getByRole('row').filter({ hasText: renamedProject })
    await projectRow.getByRole('button', { name: '删除' }).click()
    dialog = page.getByRole('dialog', { name: /^删除“/ })
    await dialog.getByRole('button', { name: '删除项目' }).click()
    await expect(page.getByText(renamedProject, { exact: true })).toHaveCount(0)
  })

  test('exports a committed snapshot and imports it only after write-free preflight', async ({ page }) => {
    const workspace = `${syntheticPrefix} backup workspace`
    const project = `${syntheticPrefix} portable project`
    await createStandardWorkspace(page, workspace)
    await createProject(page, project)

    let center = await openWorkspaceCenter(page)
    await center.getByRole('tab', { name: '备份与恢复' }).click()
    await center.getByRole('button', { name: '导出明文 JSON' }).click()

    const warning = page.getByRole('dialog', { name: '导出可直接读取的明文？' })
    const downloadPromise = page.waitForEvent('download')
    await warning.getByRole('button', { name: '导出明文 JSON' }).click()
    const download = await downloadPromise
    const exportPath = await download.path()
    expect(exportPath).not.toBeNull()
    await expect(warning).toBeHidden()

    center = page.getByRole('dialog', { name: '本地工作台', exact: true })
    await center.getByRole('button', { name: '导入 JSON' }).click()
    const importDialog = page.getByRole('dialog', { name: '把明文 JSON 导入新工作台' })
    await importDialog.getByLabel('JSON 文件').setInputFiles(exportPath!)
    await importDialog.getByRole('button', { name: '检查导入预检' }).click()

    await expect(importDialog.getByText('导入预检', { exact: true })).toBeVisible()
    await expect(importDialog.getByText('未写入', { exact: true })).toBeVisible()
    await importDialog.getByRole('button', { name: '从 JSON 创建工作台' }).click()
    await expect(importDialog).toBeHidden()
    await expect(center).toBeHidden()

    await page.goto('/#/projects?view=all')
    await expect(page.getByRole('row').filter({ hasText: project })).toBeVisible()
  })

  test('keeps nested modal backdrop, Escape, focus, and body-scroll ownership on the top dialog', async ({ page }) => {
    const center = await openWorkspaceCenter(page)
    const createButton = center.getByRole('button', { name: '新建工作台' })
    const centerElement = page.locator('section.modal--xl[role="dialog"]')
    await expect(centerElement).toContainText('本地工作台')
    await createButton.focus()
    await createButton.click()

    const createDialog = page.getByRole('dialog', { name: '创建本地工作台' })
    await expect(createDialog).toBeVisible()
    await expect(centerElement).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

    await page.locator('.modal-backdrop').last().click({ position: { x: 5, y: 5 } })
    await expect(createDialog).toHaveCount(0)
    await expect(center).toBeVisible()
    await expect(createButton).toBeFocused()
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

    await createButton.click()
    await expect(createDialog).toBeVisible()
    await expect(centerElement).toHaveAttribute('aria-hidden', 'true')
    await page.keyboard.press('Escape')
    await expect(createDialog).toHaveCount(0)
    await expect(center).toBeVisible()
    await expect(createButton).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(center).toBeHidden()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  })

  test('locks and reopens an encrypted workspace without losing committed research data', async ({ page }, testInfo) => {
    testInfo.setTimeout(90_000)
    const workspace = `${syntheticPrefix} encrypted workspace`
    const project = `${syntheticPrefix} encrypted project`
    const passphrase = `${syntheticPrefix} isolated passphrase 2026`

    const center = await openWorkspaceCenter(page)
    await center.getByRole('button', { name: '新建工作台' }).click()
    const createDialog = page.getByRole('dialog', { name: '创建本地工作台' })
    await createDialog.getByLabel('工作台名称').fill(workspace)
    await createDialog.getByRole('radio', { name: /加密本地工作台/ }).check()
    await createDialog.getByLabel('口令', { exact: true }).fill(passphrase)
    await createDialog.getByLabel('再次输入口令').fill(passphrase)
    await createDialog.getByRole('checkbox', { name: /无法恢复遗失的口令/ }).check()
    await createDialog.getByRole('button', { name: '创建工作台' }).click()
    await expect(createDialog).toHaveCount(0)
    await expect(page.locator('.brand__copy--workspace')).toContainText(workspace)

    await createProject(page, project)
    await page.getByRole('button', { name: '锁定此工作台' }).click()
    await expect(page.getByRole('heading', { name: '加密工作台已锁定' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: '加密工作台已锁定' })).toBeVisible()
    await page.getByLabel('口令').fill(passphrase)
    await page.getByRole('button', { name: '解锁工作台' }).click()
    await waitForApp(page)
    await page.goto('/#/projects?view=all')
    await expect(page.getByRole('row').filter({ hasText: project })).toBeVisible()
  })
})
