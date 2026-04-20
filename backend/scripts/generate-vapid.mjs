// Generates a P-256 VAPID key pair using Web Crypto.
// Run: node backend/scripts/generate-vapid.mjs
//
// Output prints the public and private key in base64url. Store them as:
//   wrangler secret put VAPID_PUBLIC_KEY
//   wrangler secret put VAPID_PRIVATE_KEY
// The public key is also used in the FRONTEND (public, safe to ship).

function base64UrlEncode(buf) {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return Buffer.from(binary, 'binary')
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function base64UrlDecode(s) {
	const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
	const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
	return new Uint8Array(Buffer.from(b64, 'base64'));
}

const { publicKey, privateKey } = await crypto.subtle.generateKey(
	{ name: 'ECDSA', namedCurve: 'P-256' },
	true,
	['sign', 'verify']
);

const jwkPub = await crypto.subtle.exportKey('jwk', publicKey);
const jwkPriv = await crypto.subtle.exportKey('jwk', privateKey);

// Reconstruct uncompressed EC point: 0x04 || x(32) || y(32)
const x = base64UrlDecode(jwkPub.x);
const y = base64UrlDecode(jwkPub.y);
const point = new Uint8Array(65);
point[0] = 0x04;
point.set(x, 1);
point.set(y, 33);
const publicB64 = base64UrlEncode(point);

console.log('VAPID_PUBLIC_KEY  (use with `wrangler secret put` AND as frontend env var):');
console.log(publicB64);
console.log('');
console.log('VAPID_PRIVATE_KEY (use with `wrangler secret put` — KEEP SECRET):');
console.log(jwkPriv.d);
