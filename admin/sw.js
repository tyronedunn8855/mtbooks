/* Milly's Studio: shows order alerts. Caches nothing, so the panel always loads fresh. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = {}; }
  var title = typeof m.title === 'string' ? m.title.slice(0, 60) : 'New paid order';
  var body = typeof m.body === 'string' ? m.body.slice(0, 160) : 'Open your Studio to see it.';
  e.waitUntil(self.registration.showNotification(title, { body: body, icon: '/img/icon-512.png', badge: '/img/badge-96.png', tag: 'mt-order', renotify: true, data: { url: '/admin/' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf('/admin/') > -1 && 'focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow('/admin/');
  }));
});
