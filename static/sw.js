// OMNISENSE PWA Service Worker
// 캐시 버전을 변경하면 모든 캐시가 갱신됩니다
const CACHE_NAME = 'omnisense-v1.0.1';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/onbit_lab_razor1911_noflash.gif',
  '/hideflogo.png'
];

// Install event - cache static resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing v1.0.1...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete, skipping waiting');
        return self.skipWaiting(); // 즉시 활성화
      })
      .catch(error => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - Network First 전략 (항상 최신 버전 우선)
self.addEventListener('fetch', event => {
  // Skip non-GET requests and WebRTC signaling
  if (event.request.method !== 'GET' || 
      event.request.url.includes('/post') || 
      event.request.url.includes('/ws') ||
      event.request.url.includes('/reset') ||
      event.request.url.includes('/subtitle') ||
      event.request.url.includes('/status')) {
    return;
  }

  // CSS, JS 파일은 항상 네트워크에서 최신 버전을 가져옴
  if (event.request.url.includes('.css') || 
      event.request.url.includes('.js') ||
      event.request.url.includes('/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 성공하면 캐시 업데이트
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // 네트워크 실패 시에만 캐시에서 가져옴
          return caches.match(event.request);
        })
    );
    return;
  }

  // 나머지 리소스는 캐시 우선
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .then(fetchResponse => {
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }

            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });

            return fetchResponse;
          });
      })
      .catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    // Handle offline actions when connection is restored
  }
});

// Push notifications (for future streaming alerts)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'OMNISENSE 스트리밍 알림',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'view',
          title: '스트림 보기',
          icon: '/icons/shortcut-stream.png'
        },
        {
          action: 'dismiss',
          title: '닫기'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'OMNISENSE', options)
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});