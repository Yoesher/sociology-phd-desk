import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [resolve(process.cwd(), 'src/test/setup.ts')],
    restoreMocks: true,
    clearMocks: true,
  },
})
