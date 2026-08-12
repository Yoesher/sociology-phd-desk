/// <reference lib="webworker" />

import { clientsClaim, setCacheNameDetails } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<import('workbox-build').ManifestEntry>
}

setCacheNameDetails({
  prefix: 'sociology-phd-desk',
  suffix: __APP_VERSION__,
  precache: 'static',
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

export {}
