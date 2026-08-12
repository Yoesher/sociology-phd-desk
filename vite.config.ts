import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'
import packageJson from './package.json' with { type: 'json' }

const buildSha = process.env.VITE_BUILD_SHA ?? process.env.GITHUB_SHA ?? 'development'

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_SHA__: JSON.stringify(buildSha),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'prompt',
      manifest: {
        id: './',
        name: 'Sociology PhD Desk｜社会学博士研究工作站',
        short_name: 'PhD Desk',
        description: 'Local-first sociology research workstation｜本地优先的社会学研究工作站',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f4efe4',
        theme_color: '#12354a',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
      },
    }),
  ],
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
