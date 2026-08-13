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
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
    return
  }
  if (event.data?.type === 'PREPARE_UPDATE') {
    event.waitUntil((async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const sourceId = event.source && 'id' in event.source ? event.source.id : undefined
      const otherClients = windows.filter((client) =>
        client.id !== sourceId && client.url.startsWith(self.registration.scope),
      )
      for (const client of otherClients) client.postMessage({ type: 'UPDATE_REQUESTED' })
      event.ports[0]?.postMessage({ otherClientCount: otherClients.length })
    })())
  }
})

export {}
