import { expect, test } from '@playwright/test'
import { captureBrowserDiagnostics, dismissReleaseSummary, expectNoHorizontalOverflow } from './helpers'

test('boots a fresh local workspace in Chinese without horizontal overflow', async ({ page }, testInfo) => {
  const diagnostics = captureBrowserDiagnostics(page)
  await page.goto('/#/?view=overview')
  await dismissReleaseSummary(page)

  await expect(page).toHaveTitle('Sociology PhD Desk｜社会学博士研究工作站')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('.app-shell')).toBeVisible()
  if (testInfo.project.name === 'narrow-chromium') {
    await expect(page.getByRole('button', { name: '打开导航' })).toBeVisible()
  } else {
    await expect(page.getByRole('navigation', { name: '研究工作区' })).toBeVisible()
  }

  await expectNoHorizontalOverflow(page)
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})

test('supports bilingual controls and keyboard-safe navigation', async ({ page }, testInfo) => {
  const diagnostics = captureBrowserDiagnostics(page)
  testInfo.setTimeout(45_000)
  await page.goto('/#/?view=overview')
  await dismissReleaseSummary(page)
  if (testInfo.project.name === 'desktop-chromium') {
    const moreButton = page.getByRole('button', { name: /^(更多操作|More actions)$/ })
    await moreButton.click()
    const more = page.getByRole('dialog', { name: '更多操作', exact: true })
    await expect(more).toBeVisible()
    await more.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'More actions', exact: true })).toBeHidden()
    await expect(moreButton).toBeFocused()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expectNoHorizontalOverflow(page)
    expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
    return
  }
  const moreButton = page.getByRole('button', { name: '更多' })
  await moreButton.click()

  const drawer = page.getByRole('dialog', { name: '模块导航' })
  await expect(drawer).toBeVisible()
  for (const module of ['01 · 今日', '02 · 研究项目', '03 · 文献', '04 · 理论研究', '05 · 田野与访谈', '06 · 定量分析', '07 · 证据', '08 · 研究日志', '09 · 论文与投稿']) {
    await expect(drawer.getByRole('link', { name: module, exact: true })).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(moreButton).toBeFocused()

  await moreButton.click()
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: '工作空间与设置' }).click()
  await drawer.getByRole('button', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
  const englishDrawer = page.getByRole('dialog', { name: 'Navigate' })
  await expect(englishDrawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(englishDrawer).toBeHidden()
  await expectNoHorizontalOverflow(page)
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})
