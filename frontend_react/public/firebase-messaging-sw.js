// public/firebase-messaging-sw.js

// 💡 [핵심 해결] 파이어베이스 SDK를 백그라운드에서 완전히 제거했습니다!
// 파이어베이스가 알림을 멋대로 숨겨서 애플에게 영구 차단당하는 현상을 100% 방지합니다.
// 오직 "순수 웹 푸시(Native Web Push)" 표준 기능만 사용합니다.

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// 💡 백그라운드/포그라운드 상관없이 무조건 알림을 띄우는 순수 수신기
self.addEventListener('push', function(event) {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.notification?.title || "Fashion2Cation";
  const options = {
    body: payload.notification?.body || "새로운 알림이 도착했습니다.",
    icon: '/logo192.png',
    badge: '/logo192.png', // 아이폰 상단 작은 아이콘
  };

  // 🚨 [가장 중요] 애플의 철칙 준수: 푸시가 오면 무조건 시스템 배너를 띄웁니다!
  // 단 한 번이라도 이걸 빼먹으면 보초병이 즉시 사살당합니다.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 💡 알림 배너를 클릭했을 때 앱을 열어주는 기능
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // 이미 창이 열려있으면 그 창을 보여주고, 아니면 새로 엽니다
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});