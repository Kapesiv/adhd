const CACHE_PREFIX = 'concentra-';

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(
				names
					.filter((name) => name.startsWith(CACHE_PREFIX) || name === 'adhd-app-v1')
					.map((name) => caches.delete(name))
			);

			const registrations = await self.registration.unregister();
			const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

			await Promise.all(
				clientsList.map((client) => {
					if ('navigate' in client) {
						return client.navigate(client.url);
					}
					return Promise.resolve();
				})
			);

			return registrations;
		})()
	);
});

self.addEventListener('fetch', () => {
	// Intentionally empty while service worker is disabled.
});
