import { expect, test } from '@playwright/test'
import { dismissReleaseSummary, expectNoHorizontalOverflow } from './helpers'

test('boots a fresh local workspace in Chinese without horizontal overflow', async ({ page }, testInfo) => {
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
})

test('supports bilingual controls and keyboard-safe narrow navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'narrow-chromium')
  testInfo.setTimeout(45_000)
  await page.goto('/#/?view=overview')
  await dismissReleaseSummary(page)
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
})
