import { browser } from '$app/environment';
import { base } from '$app/paths';
import type { UserSettings } from '$lib/core/state';

interface SubscribeResponse {
	id: string;
	ok: boolean;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(b64);
	const buf = new ArrayBuffer(raw.length);
	const out = new Uint8Array(buf);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out as Uint8Array<ArrayBuffer>;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
	if (!buf) return '';
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isPushSupported(): boolean {
	return (
		browser &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

export function isIos(): boolean {
	if (!browser) return false;
	const ua = navigator.userAgent;
	return /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
}

export function isStandalonePwa(): boolean {
	if (!browser) return false;
	const anyNav = navigator as unknown as { standalone?: boolean };
	return (
		window.matchMedia?.('(display-mode: standalone)').matches === true ||
		anyNav.standalone === true
	);
}

async function pushConfigToSW(payload: {
	backendUrl: string;
	subscriptionId: string;
	appUrl: string;
}): Promise<void> {
	const reg = await navigator.serviceWorker.ready;
	if (reg.active) {
		reg.active.postMessage({ type: 'set-push-config', ...payload });
	}
}

export async function subscribeToPush(
	backendUrl: string,
	vapidPublicKey: string,
	settings: UserSettings
): Promise<{ id: string }> {
	if (!isPushSupported()) throw new Error('Push ei tuettu selaimessa');

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') throw new Error('Notifikaatiolupa eväsivät');

	const reg = await navigator.serviceWorker.ready;

	let sub = await reg.pushManager.getSubscription();
	if (!sub) {
		sub = await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
		});
	}

	const subJson = sub.toJSON();
	const p256dh = subJson.keys?.p256dh;
	const auth = subJson.keys?.auth;
	if (!subJson.endpoint || !p256dh || !auth) throw new Error('Virheellinen subscription');

	const body = {
		subscription: {
			endpoint: subJson.endpoint,
			keys: { p256dh, auth }
		},
		schedule: {
			wakeUpTime: settings.wakeUpTime,
			sleepHours: settings.sleepHours,
			intensityPreference: settings.intensityPreference,
			tzOffsetMinutes: -new Date().getTimezoneOffset()
		}
	};

	const res = await fetch(`${backendUrl}/subscribe`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const err = await res.text().catch(() => '');
		throw new Error(`Backend ${res.status}: ${err}`);
	}
	const data = (await res.json()) as SubscribeResponse;

	const appUrl = window.location.origin + base;
	await pushConfigToSW({ backendUrl, subscriptionId: data.id, appUrl });

	localStorage.setItem(
		'iltavahti-push-state',
		JSON.stringify({ subscriptionId: data.id, subscribedAt: Date.now() })
	);

	return { id: data.id };
}

export async function unsubscribeFromPush(backendUrl: string): Promise<void> {
	if (!browser) return;
	const reg = await navigator.serviceWorker.ready;
	const sub = await reg.pushManager.getSubscription();
	if (sub) {
		try {
			await fetch(`${backendUrl}/subscribe`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: sub.endpoint })
			});
		} catch {
			// ignore
		}
		await sub.unsubscribe();
	}
	localStorage.removeItem('iltavahti-push-state');
}

export async function getSubscriptionState(): Promise<{ subscribed: boolean; id?: string }> {
	if (!isPushSupported()) return { subscribed: false };
	try {
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (!sub) return { subscribed: false };
		const saved = localStorage.getItem('iltavahti-push-state');
		const id = saved ? (JSON.parse(saved).subscriptionId as string) : undefined;
		return { subscribed: true, id };
	} catch {
		return { subscribed: false };
	}
}
