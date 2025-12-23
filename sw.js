const CACHE_NAME = 'quicknotes-v1.2.6';
const ASSETS_TO_CACHE = [
	'./',
	'./index.html',
	'./main.js',
	'./lang.js',
	'./manifest.json',
	'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
	'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
	'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => {
				console.log('Caching app assets');
				return cache.addAll(ASSETS_TO_CACHE);
			})
			.then(() => self.skipWaiting())
	);
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames
					.filter((name) => name !== CACHE_NAME)
					.map((name) => caches.delete(name))
			);
		}).then(() => self.clients.claim())
	);
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
	// Skip API calls - always go to network
	if (event.request.url.includes('/api/')) {
		return;
	}

	event.respondWith(
		caches.match(event.request)
			.then((response) => {
				if (response) {
					return response;
				}
				return fetch(event.request).then((response) => {
					// Don't cache non-successful responses
					if (!response || response.status !== 200 || response.type !== 'basic') {
						return response;
					}
					// Clone and cache
					const responseToCache = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});
					return response;
				});
			})
			.catch(() => {
				// Offline fallback for HTML pages
				if (event.request.mode === 'navigate') {
					return caches.match('./index.html');
				}
			})
	);
});
