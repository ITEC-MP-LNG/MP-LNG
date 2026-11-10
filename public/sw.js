
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: '통합 현장 관리',
      body: event.data ? event.data.text() : '새로운 알림이 있습니다.'
    };
  }

  const title = data.title || '통합 현장 관리';

  const options = {
    body: data.body || '새로운 업무 알림이 있습니다.',
    icon: '/icon-192.jpg',
    badge: '/notification-badge-white.png',
    data: {
      url: data.url || '/'
    },
    tag: data.tag || 'daily-work-notification',
    renotify: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  ).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});
