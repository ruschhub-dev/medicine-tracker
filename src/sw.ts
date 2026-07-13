/// <reference lib="webworker" />
// Service Worker customizado: mantém o precache do PWA e adiciona Web Push.
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Precache dos arquivos do app (a lista é injetada pelo build).
precacheAndRoute(self.__WB_MANIFEST)

// Navegações (rotas do SPA) caem no index.html do cache quando offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Recebe a notificação push e a exibe.
self.addEventListener('push', (event) => {
  let payload: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data?.text() }
  }
  const title = payload.title || 'Remédios da Família'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || 'validade',
      data: { url: payload.url || '/' },
    }),
  )
})

// Ao tocar na notificação, abre ou foca o app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
