/*
 * Rest alerts in the service worker: shows the push sent by the rest-alarm
 * Edge Function (see src/lib/restAlerts.ts) and opens the app when tapped.
 * vite.config.ts imports this into the generated worker (workbox.importScripts).
 *
 * Every push must show a notification: iOS revokes push for web apps that
 * receive pushes silently.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rest over', {
      body: data.body || 'Time for your next set.',
      // One rest alert at a time: a new one replaces the last.
      tag: data.tag || 'rest-timer',
      renotify: true,
      icon: '/icons/icon-192.png',
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Bring the app back as it was (mid-workout); only open a page if it's closed.
      const open = windows.find((w) => w.url.startsWith(self.location.origin))
      if (open) return open.focus()
      return self.clients.openWindow(url)
    })(),
  )
})
