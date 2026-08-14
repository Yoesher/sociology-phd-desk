import { expect, test } from '@playwright/test'
import { createProject, createStandardWorkspace, syntheticPrefix, waitForApp } from './helpers'

test('a stale tab cannot overwrite a newer committed workspace snapshot', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  testInfo.setTimeout(60_000)
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 720 } })
  await context.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true })
  })
  const first = await context.newPage()
  await first.goto('/')
  await waitForApp(first)

  const workspace = `${syntheticPrefix} stale-tab workspace`
  const project = `${syntheticPrefix} stale-tab project`
  await createStandardWorkspace(first, workspace)
  await createProject(first, project)

  const second = await context.newPage()
  await second.goto('/#/projects?view=all')
  await waitForApp(second)
  await expect(second.getByRole('row').filter({ hasText: project })).toBeVisible()

  const firstRow = first.getByRole('row').filter({ hasText: project })
  const secondRow = second.getByRole('row').filter({ hasText: project })
  await firstRow.getByRole('button', { name: '编辑' }).click()
  await secondRow.getByRole('button', { name: '编辑' }).click()

  const winner = `${project} winner`
  const stale = `${project} stale`
  const firstDialog = first.getByRole('dialog', { name: '编辑研究项目' })
  const secondDialog = second.getByRole('dialog', { name: '编辑研究项目' })
  await firstDialog.getByLabel('项目标题').fill(winner)
  await firstDialog.getByRole('button', { name: '保存更改' }).click()
  await expect(first.getByRole('row').filter({ hasText: winner })).toBeVisible()

  await secondDialog.getByLabel('项目标题').fill(stale)
  await secondDialog.getByRole('button', { name: '保存更改' }).click()
  await expect(second.getByRole('heading', { name: '工作台界面已锁定' })).toBeVisible()

  await second.getByRole('button', { name: '重新打开工作台' }).click()
  await waitForApp(second)
  await expect(second.getByRole('row').filter({ hasText: winner })).toBeVisible()
  await expect(second.getByText(stale, { exact: true })).toHaveCount(0)
  await context.close()
})
