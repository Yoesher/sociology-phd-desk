import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const dist = resolve(root, 'dist')

function assert(condition, message) {
  if (!condition) throw new Error(`PWA build verification failed: ${message}`)
}

const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.webmanifest'), 'utf8'))
assert(manifest.start_url === './', 'manifest start_url must remain relative to the deployed app root')
assert(manifest.scope === './', 'manifest scope must remain limited to the deployed app root')
assert(manifest.display === 'standalone', 'manifest must support installed standalone mode')
assert(Array.isArray(manifest.icons), 'manifest icons are missing')
assert(manifest.icons.some((icon) => icon.sizes === '192x192'), '192x192 install icon is missing')
assert(manifest.icons.some((icon) => icon.sizes === '512x512'), '512x512 install icon is missing')

for (const icon of ['icons/app-192.png', 'icons/app-512.png']) {
  assert((await stat(resolve(dist, icon))).size > 0, `${icon} was not emitted`)
}

const serviceWorker = await readFile(resolve(dist, 'sw.js'), 'utf8')
assert(serviceWorker.includes('sociology-phd-desk'), 'service worker cache namespace is missing')
assert(serviceWorker.includes('SKIP_WAITING'), 'prompted update activation message is missing')
assert(serviceWorker.includes('manifest.webmanifest'), 'static precache manifest was not injected')

const source = await readFile(resolve(root, 'src', 'sw.ts'), 'utf8')
assert(!source.includes('workbox-routing'), 'runtime routing must not be added to the service worker')
assert(!source.includes('workbox-strategies'), 'runtime caching strategies must not be added to the service worker')
assert(!source.includes('fetch('), 'service worker must not proxy arbitrary network or research requests')

console.log(`PWA build contract PASS: ${manifest.name}; static precache only; ${manifest.icons.length} icons`)
