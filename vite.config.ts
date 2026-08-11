import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/]/ },
            { name: 'i18n', test: /src[\\/]i18n[\\/]messages[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [resolve(process.cwd(), 'src/test/setup.ts')],
    restoreMocks: true,
    clearMocks: true,
  },
})
