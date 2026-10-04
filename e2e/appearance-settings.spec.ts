import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { WorkspaceData } from '../src/models/domain'
import {
  captureBrowserDiagnostics,
  createProject,
  createStandardWorkspace,
  expectNoHorizontalOverflow,
  openWorkspaceCenter,
  waitForApp,
} from './helpers'

const settingsKey = 'sociology-phd-desk-settings'
const appearanceTitle = /^(外观与动效|Appearance & motion)$/
const preferenceLabels = {
  template: /^(界面模板|Interface template)$/,
  font: /^(字体风格|Font style)$/,
  textSize: /^(字号|Text size)$/,
  motion: /^(切换动画|Transition animation)$/,
}
const defaults = { template: 'classic', font: 'academic', textSize: 'standard', motion: 'gentle' }

async function chromeMenu(page: Page): Promise<Locator> {
  if ((page.viewportSize()?.width ?? 1280) <= 1024) {
    const drawer = page.getByRole('dialog', { name: /^(模块导航|Navigate)$/ })
    if (!await drawer.isVisible()) {
      await page.getByRole('button', { name: /^(打开导航|Open navigation)$/ }).click()
    }
    await expect(drawer).toBeVisible()
    const settings = drawer.getByRole('button', { name: /^(工作空间与设置|Workspace & Settings)$/ })
    if (await settings.getAttribute('aria-expanded') !== 'true') await settings.click()
    return drawer
  }
  const more = page.getByRole('dialog', { name: /^(更多操作|More actions)$/ })
  if (!await more.isVisible()) {
    await page.getByRole('button', { name: /^(更多操作|More actions)$/ }).click()
  }
  await expect(more).toBeVisible()
  return more
}

async function closeChromeMenu(page: Page) {
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
  await expect(page.locator('.mobile-menu-backdrop[data-closing], .topbar-more__menu[data-closing]')).toHaveCount(0)
}

async function openAppearance(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog', { name: appearanceTitle })
  if (!await dialog.isVisible()) {
    const menu = await chromeMenu(page)
    await menu.getByRole('button', { name: appearanceTitle }).click()
  }
  await expect(dialog).toBeVisible()
  for (const label of Object.values(preferenceLabels)) {
    await expect(dialog.getByRole('combobox', { name: label })).toBeVisible()
  }
  return dialog
}

async function closeAppearance(page: Page, dialog: Locator) {
  await dialog.getByRole('button', { name: /^(完成|Done)$/ }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
  await closeChromeMenu(page)
  await expectAppearanceTriggerFocused(page)
}

async function expectAppearanceTriggerFocused(page: Page) {
  await expect(page.getByRole('button', {
    name: (page.viewportSize()?.width ?? 1280) <= 1024
      ? /^(打开导航|Open navigation)$/
      : /^(更多操作|More actions)$/,
  })).toBeFocused()
}

async function expectPreferences(page: Page, preferences: typeof defaults) {
  const root = page.locator('html')
  for (const [key, value] of Object.entries(preferences)) {
    await expect(root).toHaveAttribute(key === 'textSize' ? 'data-text-size' : `data-${key}`, value)
  }
}

async function settingsSnapshot(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), settingsKey)
}

async function exportCompleteWorkspace(page: Page): Promise<WorkspaceData> {
  const center = await openWorkspaceCenter(page)
  await center.getByRole('tab', { name: '备份与恢复', exact: true }).click()
  await center.getByRole('button', { name: '导出明文 JSON', exact: true }).click()
  const warning = page.getByRole('dialog', { name: '导出可直接读取的明文？', exact: true })
  const event = page.waitForEvent('download')
  await warning.getByRole('button', { name: '导出明文 JSON', exact: true }).click()
  const download = await event
  const snapshot = JSON.parse(await readFile((await download.path())!, 'utf8')) as WorkspaceData
  // A hidden closing child still keeps the parent inert until it unregisters.
  await expect(page.locator('.modal-backdrop[data-closing]')).toHaveCount(0)
  await expect(center).toBeVisible()
  await center.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
  await closeChromeMenu(page)
  return snapshot
}

function withoutExportTime(snapshot: WorkspaceData) {
  const { exportedAt: _exportedAt, ...content } = snapshot
  return content
}

async function expectReadableControls(dialog: Locator) {
  const metrics = await dialog.getByRole('combobox').evaluateAll((elements) => {
    const channels = (color: string) => {
      const values = color.match(/[\d.]+/g)?.map(Number) ?? []
      return values.slice(0, 3)
    }
    const luminance = (rgb: number[]) => rgb.map((value) => {
      const channel = value / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0)
    return elements.map((element) => {
      const style = getComputedStyle(element)
      let parent: Element | null = element
      let background = style.backgroundColor
      while ((background === 'transparent' || background === 'rgba(0, 0, 0, 0)') && parent?.parentElement) {
        parent = parent.parentElement
        background = getComputedStyle(parent).backgroundColor
      }
      const foregroundLuminance = luminance(channels(style.color))
      const backgroundLuminance = luminance(channels(background))
      return {
        fontSize: Number.parseFloat(style.fontSize),
        fontFamily: style.fontFamily,
        contrast: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
      }
    })
  })
  expect(metrics).toHaveLength(4)
  for (const metric of metrics) {
    expect(metric.fontSize).toBeGreaterThanOrEqual(14)
    expect(metric.fontFamily).not.toBe('')
    expect(metric.contrast).toBeGreaterThanOrEqual(4.5)
  }
}

function captureExternalFonts(page: Page) {
  const externalFonts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() !== 'font') return
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalFonts.push(request.url())
  })
  return externalFonts
}

test('appearance choices persist with language and theme while complete research backup remains identical', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000)
  const diagnostics = captureBrowserDiagnostics(page)
  const externalFonts = captureExternalFonts(page)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
  await page.goto('/')
  await waitForApp(page)
  await createStandardWorkspace(page, 'DEMO E2E appearance isolated workspace')
  await createProject(page, 'DEMO E2E unchanged research title 中文')
  await page.goto('/#/?view=tasks')
  await waitForApp(page)
  await page.getByRole('button', { name: '添加研究任务', exact: true }).click()
  const task = page.getByRole('dialog', { name: '添加研究任务', exact: true })
  await task.getByRole('textbox', { name: '任务', exact: true }).fill('DEMO E2E unchanged research task')
  await task.getByLabel('截止日期', { exact: true }).fill('2099-01-10')
  await task.getByRole('textbox', { name: '备注', exact: true }).fill('DEMO E2E untranslated research notes 中文')
  await task.getByRole('button', { name: '添加任务', exact: true }).click()
  await expect(task).toBeHidden()
  const before = await exportCompleteWorkspace(page)
  expect(before.projects).toHaveLength(1)
  expect(before.tasks).toHaveLength(1)

  let dialog = await openAppearance(page)
  await expectPreferences(page, defaults)
  const palettes: string[] = []
  for (const template of ['classic', 'paper', 'slate', 'forest']) {
    await dialog.getByRole('combobox', { name: preferenceLabels.template }).selectOption(template)
    await expect(page.locator('html')).toHaveAttribute('data-template', template)
    palettes.push(await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor))
    await expectReadableControls(dialog)
    await expectNoHorizontalOverflow(page)
  }
  expect(new Set(palettes).size).toBe(4)
  const fonts: string[] = []
  for (const font of ['academic', 'sans', 'serif', 'system']) {
    await dialog.getByRole('combobox', { name: preferenceLabels.font }).selectOption(font)
    await expect(page.locator('html')).toHaveAttribute('data-font', font)
    fonts.push(await dialog.getByRole('combobox', { name: preferenceLabels.font }).evaluate((element) => getComputedStyle(element).fontFamily))
    await expectReadableControls(dialog)
  }
  expect(new Set(fonts).size).toBeGreaterThanOrEqual(3)
  const sizes: number[] = []
  for (const textSize of ['standard', 'large', 'larger']) {
    await dialog.getByRole('combobox', { name: preferenceLabels.textSize }).selectOption(textSize)
    sizes.push(await dialog.getByRole('combobox', { name: preferenceLabels.textSize }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)))
    await expectReadableControls(dialog)
    await expectNoHorizontalOverflow(page)
  }
  expect(sizes[1]).toBeGreaterThan(sizes[0]!)
  expect(sizes[2]).toBeGreaterThan(sizes[1]!)
  for (const motion of ['gentle', 'fade', 'slide', 'none']) {
    await dialog.getByRole('combobox', { name: preferenceLabels.motion }).selectOption(motion)
    await expect(page.locator('html')).toHaveAttribute('data-motion', motion)
  }
  await closeAppearance(page, dialog)
  let menu = await chromeMenu(page)
  await menu.getByRole('button', { name: /^(使用深色主题|切换明暗主题)$/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await menu.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await closeChromeMenu(page)
  const chosen = { template: 'forest', font: 'system', textSize: 'larger', motion: 'none' }
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await expectPreferences(page, chosen)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await settingsSnapshot(page)).toMatchObject({ ...chosen, language: 'en', theme: 'dark' })
  dialog = await openAppearance(page)
  for (const [key, value] of Object.entries(chosen)) {
    await expect(dialog.getByRole('combobox', { name: preferenceLabels[key as keyof typeof preferenceLabels] })).toHaveValue(value)
  }
  await expectReadableControls(dialog)
  await expectNoHorizontalOverflow(page)
  const darkPalettes: string[] = []
  for (const template of ['classic', 'paper', 'slate', 'forest']) {
    await dialog.getByRole('combobox', { name: preferenceLabels.template }).selectOption(template)
    darkPalettes.push(await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor))
    await expectReadableControls(dialog)
    await expectNoHorizontalOverflow(page)
  }
  expect(new Set(darkPalettes).size).toBe(4)
  darkPalettes.forEach((palette, index) => expect(palette).not.toBe(palettes[index]))
  await dialog.getByRole('combobox', { name: preferenceLabels.template }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('combobox', { name: preferenceLabels.font })).toBeFocused()
  await dialog.getByRole('button', { name: 'Restore appearance defaults', exact: true }).click()
  await expectPreferences(page, defaults)
  expect(await settingsSnapshot(page)).toMatchObject({ ...defaults, language: 'en', theme: 'dark' })
  await closeAppearance(page, dialog)
  menu = await chromeMenu(page)
  await menu.getByRole('button', { name: '简体中文', exact: true }).click()
  await closeChromeMenu(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  const after = await exportCompleteWorkspace(page)
  expect(withoutExportTime(after)).toEqual(withoutExportTime(before))
  for (const key of ['settings', 'appearance', 'language', 'theme', 'template', 'font', 'textSize', 'motion']) {
    expect(after).not.toHaveProperty(key)
    expect(after.workspace).not.toHaveProperty(key)
  }
  await page.reload()
  await waitForApp(page)
  await expectPreferences(page, defaults)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: /^DEMO E2E unchanged research task/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  expect(externalFonts).toEqual([])
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})

test('open tabs share appearance changes without reload or overwriting saved preferences', async ({ page, context }, testInfo) => {
  testInfo.setTimeout(75_000)
  const primaryDiagnostics = captureBrowserDiagnostics(page)
  await page.goto('/')
  await waitForApp(page)
  const observer = await context.newPage()
  const observerDiagnostics = captureBrowserDiagnostics(observer)
  await observer.goto('/')
  await waitForApp(observer)
  const observerDialog = await openAppearance(observer)
  const primaryDialog = await openAppearance(page)
  const shared = { template: 'paper', font: 'serif', textSize: 'large', motion: 'fade' }
  for (const [key, value] of Object.entries(shared)) {
    const label = preferenceLabels[key as keyof typeof preferenceLabels]
    await primaryDialog.getByRole('combobox', { name: label }).selectOption(value)
    await expect(observerDialog.getByRole('combobox', { name: label })).toHaveValue(value)
  }
  await expectPreferences(observer, shared)
  await observerDialog.getByRole('combobox', { name: preferenceLabels.motion }).selectOption('none')
  await expect(primaryDialog.getByRole('combobox', { name: preferenceLabels.motion })).toHaveValue('none')
  await expectPreferences(page, { ...shared, motion: 'none' })
  expect(await settingsSnapshot(page)).toMatchObject({ ...shared, motion: 'none', language: 'zh-CN' })
  await closeAppearance(page, primaryDialog)
  await closeAppearance(observer, observerDialog)
  await expectNoHorizontalOverflow(page)
  await expectNoHorizontalOverflow(observer)
  expect(primaryDiagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
  expect(observerDiagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
  await observer.close()
})

test('none and system reduced motion disable real animations and close dialogs without an exit wait', async ({ page }, testInfo) => {
  testInfo.setTimeout(75_000)
  const diagnostics = captureBrowserDiagnostics(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await waitForApp(page)
  // Warm both routes so module loading cannot consume the short animation
  // before a browser-side observer sees the next real navigation.
  await page.evaluate(() => { window.location.hash = '/projects?view=all' })
  await expect(page.getByRole('heading', { name: '研究项目', exact: true })).toBeVisible()
  await page.evaluate(() => { window.location.hash = '/?view=tasks' })
  await expect(page.getByRole('button', { name: '添加研究任务', exact: true })).toBeVisible()
  const positiveFrames: Record<string, { opacity: string; transform: string | null }[]> = {}
  for (const [index, motion] of ['gentle', 'fade', 'slide'].entries()) {
    const appearance = await openAppearance(page)
    await appearance.getByRole('combobox', { name: preferenceLabels.motion }).selectOption(motion)
    await closeAppearance(page, appearance)
    positiveFrames[motion] = await page.evaluate(async (nextHash) => {
      const previous = new Set(document.querySelector('.motion-page-boundary')?.getAnimations() ?? [])
      window.location.hash = nextHash
      return new Promise<{ opacity: string; transform: string | null }[]>((resolve, reject) => {
        const started = performance.now()
        const sample = () => {
          const animation = document.querySelector('.motion-page-boundary')?.getAnimations()
            .find((candidate) => !previous.has(candidate) && candidate.effect instanceof KeyframeEffect)
          if (animation?.effect instanceof KeyframeEffect) {
            resolve(animation.effect.getKeyframes().map((frame) => ({
              opacity: String(frame.opacity),
              transform: frame.transform === undefined ? null : String(frame.transform),
            })))
            return
          }
          if (performance.now() - started >= 2_000) {
            reject(new Error('No real route animation was observed after navigation.'))
            return
          }
          requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
    }, index % 2 === 0 ? '/projects?view=all' : '/?view=tasks')
    expect(positiveFrames[motion].some((frame) => Number(frame.opacity) === 0)).toBe(true)
    expect(positiveFrames[motion].some((frame) => Number(frame.opacity) === 1)).toBe(true)
  }
  expect(positiveFrames.gentle!.some((frame) => /translateY\(/.test(frame.transform ?? ''))).toBe(true)
  expect(positiveFrames.fade!.every((frame) => frame.transform === null)).toBe(true)
  expect(positiveFrames.slide!.some((frame) => /translateX\(/.test(frame.transform ?? ''))).toBe(true)
  await testInfo.attach('real-route-animation-keyframes', {
    body: Buffer.from(JSON.stringify(positiveFrames, null, 2)), contentType: 'application/json',
  })
  let dialog = await openAppearance(page)
  await dialog.getByRole('combobox', { name: preferenceLabels.motion }).selectOption('none')
  const expectNoRouteAnimation = async () => {
    // Sample multiple real paint frames so a delayed passive React effect
    // cannot make an accidentally animated route look motion-free.
    const counts = await page.locator('.motion-page-boundary').evaluate(async (element) => {
      const observations: number[] = []
      for (let frame = 0; frame < 12; frame++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        observations.push(element.getAnimations().length)
      }
      return observations
    })
    expect(counts.every((count) => count === 0)).toBe(true)
  }
  const expectDisabledMotion = async () => {
    for (const selector of ['.modal', '.modal-backdrop']) {
      const styles = await page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element)
        return { animationName: style.animationName, transitions: style.transitionDuration.split(',').map(Number.parseFloat) }
      })
      expect(styles.animationName).toBe('none')
      expect(styles.transitions.every((duration) => duration === 0)).toBe(true)
    }
    expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running' || animation.pending).length)).toBe(0)
  }
  await expectDisabledMotion()
  await dialog.getByRole('button', { name: '完成', exact: true }).click()
  // Inspect the state immediately after the click's React commit, before a
  // delayed exit could be hidden by Playwright's retrying expectations.
  expect(await page.locator('.modal-backdrop').count()).toBe(0)
  await closeChromeMenu(page)
  await expectAppearanceTriggerFocused(page)
  await page.evaluate(() => { window.location.hash = '/?view=tasks' })
  await expect(page.getByRole('button', { name: '添加研究任务', exact: true })).toBeVisible()
  await expectNoRouteAnimation()

  dialog = await openAppearance(page)
  await dialog.getByRole('combobox', { name: preferenceLabels.motion }).selectOption('slide')
  await closeAppearance(page, dialog)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  dialog = await openAppearance(page)
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'slide')
  await expectDisabledMotion()
  await page.keyboard.press('Escape')
  expect(await page.locator('.modal-backdrop').count()).toBe(0)
  await closeChromeMenu(page)
  await expectAppearanceTriggerFocused(page)
  await page.evaluate(() => { window.location.hash = '/projects?view=all' })
  await expect(page.getByRole('heading', { name: '研究项目', exact: true })).toBeVisible()
  await expectNoRouteAnimation()
  await expectNoHorizontalOverflow(page)
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})
