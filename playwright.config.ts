import { defineConfig } from '@playwright/test'

const localChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
const webServerCommand = process.env.CI
  ? 'npm run preview -- --host 127.0.0.1 --port 4173'
  : 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173'

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: localChromium ? { executablePath: localChromium } : undefined,
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'narrow-chromium',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
