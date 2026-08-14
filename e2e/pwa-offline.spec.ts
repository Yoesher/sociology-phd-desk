import { expect, test } from '@playwright/test'
import { waitForApp } from './helpers'

test('starts from the production app shell offline and recovers online', async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  testInfo.setTimeout(60_000)

  await page.goto('/#/?view=overview')
  await waitForApp(page)
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) return null
    return await fetch(link.href).then((response) => response.json()) as {
      name?: string
      start_url?: string
      display?: string
      icons?: Array<{ src?: string; sizes?: string }>
    }
  })
  expect(manifest).toMatchObject({
    name: 'Sociology PhD Desk｜社会学博士研究工作站',
    start_url: './',
    display: 'standalone',
  })
  expect(manifest?.icons?.length).toBeGreaterThanOrEqual(2)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload()
    await waitForApp(page)
  }
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  try {
    await context.setOffline(true)
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForApp(page)
    await expect(page.locator('.app-shell')).toBeVisible()
    const offlineProbe = await page.evaluate(async () => {
      try {
        await fetch(`/__e2e-network-probe__?offline=${Date.now()}`, { cache: 'no-store' })
        return true
      } catch {
        return false
      }
    })
    expect(offlineProbe).toBe(false)

    await context.setOffline(false)
    await expect.poll(() => page.evaluate(async () => {
      try {
        await fetch(`/__e2e-network-probe__?online=${Date.now()}`, { cache: 'no-store' })
        return true
      } catch {
        return false
      }
    })).toBe(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForApp(page)
  } finally {
    await context.setOffline(false)
  }
})
