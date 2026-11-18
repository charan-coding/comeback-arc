// Extra service worker logic, appended to the Workbox-generated service worker via
// vite.config.ts's `workbox.importScripts`. Pushes are sent with an empty body (see
// backend/Code.gs's Web Push section), so there is no per-notification text to read —
// every push shows the same friendly reminder.
self.addEventListener('push', function (event) {
  event.waitUntil(
    self.registration.showNotification('Comeback Arc', {
      body: "⏰ You haven't logged today yet — keep the streak alive!",
      // Relative (no leading slash) so these resolve against the service worker's own
      // scope regardless of whether the app is deployed at a root or a subpath (e.g.
      // GitHub Pages' /comeback-arc/).
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'comeback-arc-reminder',
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
    })
  );
});
