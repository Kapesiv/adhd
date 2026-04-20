// VAPID (RFC 8292) JWT signing + Web Push sender for Cloudflare Workers.
// Uses Web Crypto API; no node deps. Sends empty-body pushes (no payload
// encryption) — the SW fetches the message text from /message after wake-up.

export interface VapidKeys {
	publicKey: string; // base64url of 65-byte uncompressed EC point
	privateKey: string; // base64url of 32-byte private scalar
	subject: string; // mailto:... or https://...
}

export interface PushSubscription {
	endpoint: string;
	p256dh: string;
	auth: string;
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Uint8Array {
	const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
	const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(b64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

async function importPrivateKey(keys: VapidKeys): Promise<CryptoKey> {
	const pub = base64UrlDecode(keys.publicKey);
	if (pub.byteLength !== 65 || pub[0] !== 0x04) {
		throw new Error('VAPID_PUBLIC_KEY must be 65-byte uncompressed EC point');
	}
	const x = base64UrlEncode(pub.subarray(1, 33));
	const y = base64UrlEncode(pub.subarray(33, 65));
	const jwk: JsonWebKey = {
		kty: 'EC',
		crv: 'P-256',
		x,
		y,
		d: keys.privateKey,
		ext: true
	};
	return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
		'sign'
	]);
}

async function signJwt(keys: VapidKeys, audience: string, expSeconds = 12 * 3600): Promise<string> {
	const header = { typ: 'JWT', alg: 'ES256' };
	const payload = {
		aud: audience,
		exp: Math.floor(Date.now() / 1000) + expSeconds,
		sub: keys.subject
	};
	const enc = new TextEncoder();
	const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
	const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
	const signingInput = `${headerB64}.${payloadB64}`;
	const key = await importPrivateKey(keys);
	const sig = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		key,
		enc.encode(signingInput)
	);
	return `${signingInput}.${base64UrlEncode(sig)}`;
}

function endpointOrigin(endpoint: string): string {
	const url = new URL(endpoint);
	return `${url.protocol}//${url.host}`;
}

export interface PushSendResult {
	ok: boolean;
	status: number;
	expired: boolean; // 404/410 — subscription should be removed
	error?: string;
}

export async function sendEmptyPush(
	keys: VapidKeys,
	subscription: PushSubscription,
	ttlSeconds = 60
): Promise<PushSendResult> {
	const audience = endpointOrigin(subscription.endpoint);
	const jwt = await signJwt(keys, audience);

	const headers: Record<string, string> = {
		TTL: String(ttlSeconds),
		Authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
		'Content-Length': '0',
		Urgency: 'high'
	};

	const res = await fetch(subscription.endpoint, {
		method: 'POST',
		headers,
		body: null
	});

	const expired = res.status === 404 || res.status === 410;
	return {
		ok: res.ok,
		status: res.status,
		expired,
		error: res.ok ? undefined : await res.text().catch(() => undefined)
	};
}
