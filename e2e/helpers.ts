import { expect, type Page } from '@playwright/test'

export const syntheticPrefix = 'DEMO E2E'

export async function dismissReleaseSummary(page: Page) {
  const summary = page.getByRole('dialog', { name: /v\d+\.\d+\.\d+ 更新摘要/ })
  const opened = await summary.waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true, () => false)
  if (!opened) return
  await summary.getByRole('button', { name: '知道了' }).click()
  await expect(summary).toBeHidden()
}

export async function waitForApp(page: Page) {
  await expect(page.locator('.app-shell')).toBeVisible()
  await dismissReleaseSummary(page)
  await expect(page.getByRole('navigation', { name: '研究工作区' })).toBeVisible()
}

export async function openWorkspaceCenter(page: Page) {
  const center = page.getByRole('dialog', { name: '本地工作台', exact: true })
  if (await center.isVisible().catch(() => false)) return center

  await page.getByRole('button', { name: '更多操作' }).click()
  const more = page.getByRole('dialog', { name: '更多操作' })
  await expect(more).toBeVisible()
  await more.getByRole('button', { name: '工作空间与设置' }).click()
  await expect(center).toBeVisible()
  await expect(center.getByRole('button', { name: '关闭对话框' })).toBeFocused()
  return center
}

export async function createStandardWorkspace(page: Page, name: string) {
  const center = await openWorkspaceCenter(page)
  await center.getByRole('button', { name: '新建工作台' }).click()

  const createDialog = page.getByRole('dialog', { name: '创建本地工作台' })
  await expect(createDialog).toBeVisible()
  await createDialog.getByLabel('工作台名称').fill(name)
  await createDialog.getByRole('radio', { name: /标准本地工作台/ }).check()
  await createDialog.getByRole('button', { name: '创建工作台' }).click()

  await expect(createDialog).toBeHidden()
  await expect(center).toBeHidden()
  await expect(page.locator('.brand__copy--workspace')).toContainText(name)
  await waitForApp(page)
}

export async function createProject(page: Page, title: string) {
  await page.goto('/#/projects?view=all')
  await waitForApp(page)
  await page.getByRole('button', { name: '新建项目' }).click()

  const dialog = page.getByRole('dialog', { name: '创建研究项目' })
  await dialog.getByLabel('项目标题').fill(title)
  await dialog.getByText('更多选项', { exact: true }).click()
  await dialog.getByLabel('主题').fill(`${title} synthetic topic`)
  await dialog.getByLabel('开始日期').fill('2026-08-14')
  await dialog.getByRole('button', { name: '创建项目' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row').filter({ hasText: title })).toBeVisible()
}

export async function waitForPersistedProjectTitle(page: Page, title: string) {
  await expect.poll(
    () => page.evaluate(async (expectedTitle) => {
      const databases = await indexedDB.databases()
      const names = databases
        .map((database) => database.name)
        .filter((name): name is string => Boolean(name?.startsWith('sociology-phd-desk-workspace-')))

      const containsProject = (databaseName: string) => new Promise<boolean>((resolve) => {
        const openRequest = indexedDB.open(databaseName)
        openRequest.onerror = () => resolve(false)
        openRequest.onsuccess = () => {
          const database = openRequest.result
          if (!database.objectStoreNames.contains('projects')) {
            database.close()
            resolve(false)
            return
          }

          const transaction = database.transaction('projects', 'readonly')
          const request = transaction.objectStore('projects').getAll()
          request.onerror = () => {
            database.close()
            resolve(false)
          }
          request.onsuccess = () => {
            const found = request.result.some((record) => (
              typeof record === 'object' &&
              record !== null &&
              'title' in record &&
              record.title === expectedTitle
            ))
            database.close()
            resolve(found)
          }
        }
      })

      for (const name of names) {
        if (await containsProject(name)) return true
      }
      return false
    }, title),
    { message: `project ${title} was not committed to IndexedDB`, timeout: 10_000 },
  ).toBe(true)
}

export async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth)
}
