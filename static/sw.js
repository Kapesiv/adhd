const CACHE_NAME = 'concentra-static-v2';
const CONFIG_DB = 'iltavahti-sw';
const CONFIG_STORE = 'config';

function shouldCache(request, response) {
	if (!response || response.status !== 200) return false;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return false;
	if (request.mode === 'navigate') return false;

	return (
		url.pathname.includes('/_app/immutable/') ||
		url.pathname.endsWith('.css') ||
		url.pathname.endsWith('.js') ||
		url.pathname.endsWith('.png') ||
		url.pathname.endsWith('.svg') ||
		url.pathname.endsWith('.woff2') ||
		url.pathname.endsWith('manifest.json')
	);
}

function openConfigDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(CONFIG_DB, 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(CONFIG_STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function getConfig() {
	try {
		const db = await openConfigDB();
		return await new Promise((resolve) => {
			const tx = db.transaction(CONFIG_STORE, 'readonly');
			const req = tx.objectStore(CONFIG_STORE).get('main');
			req.onsuccess = () => resolve(req.result || null);
			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

async function setConfig(value) {
	try {
		const db = await openConfigDB();
		await new Promise((resolve, reject) => {
			const tx = db.transaction(CONFIG_STORE, 'readwrite');
			tx.objectStore(CONFIG_STORE).put(value, 'main');
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch {
		// best-effort
	}
}

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((names) =>
			Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	event.respondWith(
		fetch(event.request)
			.then((response) => {
				if (shouldCache(event.request, response)) {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
				}
				return response;
			})
			.catch(async () => {
				const cached = await caches.match(event.request);
				if (cached) return cached;
				throw new Error(`Network failed for ${event.request.url}`);
			})
	);
});

self.addEventListener('message', (event) => {
	const data = event.data;
	if (!data || typeof data !== 'object') return;
	if (data.type === 'set-push-config') {
		event.waitUntil(
			setConfig({
				backendUrl: data.backendUrl,
				subscriptionId: data.subscriptionId,
				appUrl: data.appUrl
			})
		);
	}
});

self.addEventListener('push', (event) => {
	event.waitUntil(
		(async () => {
			let title = 'Concentra';
			let body = 'Aika rauhoittua.';
			let url = '/';

			const config = await getConfig();
			if (config?.backendUrl && config?.subscriptionId) {
				try {
					const res = await fetch(
						`${config.backendUrl}/message?id=${encodeURIComponent(config.subscriptionId)}`,
						{ cache: 'no-store' }
					);
					if (res.ok) {
						const msg = await res.json();
						if (msg.title) title = msg.title;
						if (msg.body) body = msg.body;
						if (msg.url) url = msg.url;
					}
				} catch {
					// fall through to default message
				}
			}

			if (config?.appUrl && url === '/') url = config.appUrl;

			await self.registration.showNotification(title, {
				body,
				tag: 'iltavahti',
				renotify: true,
				requireInteraction: true,
				icon: config?.appUrl ? `${config.appUrl}/icons/icon-192x192.png` : undefined,
				badge: config?.appUrl ? `${config.appUrl}/icons/icon-192x192.png` : undefined,
				data: { url }
			});
		})()
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const targetUrl = event.notification.data?.url || '/';
	event.waitUntil(
		(async () => {
			const clientsList = await self.clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});
			for (const client of clientsList) {
				if ('focus' in client) {
					await client.focus();
					if ('navigate' in client && targetUrl) {
						try {
							await client.navigate(targetUrl);
						} catch {
							// ignore
						}
					}
					return;
				}
			}
			await self.clients.openWindow(targetUrl);
		})()
	);
});
