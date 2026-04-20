import { sendEmptyPush, type VapidKeys, type PushSubscription } from './vapid';
import { dayOfYearUTC, pickMessage, type SlotKey, type Message } from './messages';

export interface Env {
	DB: D1Database;
	VAPID_PUBLIC_KEY: string;
	VAPID_PRIVATE_KEY: string;
	VAPID_SUBJECT: string;
	CORS_ORIGIN: string;
}

// --------------------------------------------------------------- helpers

function corsHeaders(env: Env): HeadersInit {
	return {
		'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '86400'
	};
}

function jsonResponse(env: Env, data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...corsHeaders(env) }
	});
}

function errorResponse(env: Env, msg: string, status = 400): Response {
	return jsonResponse(env, { error: msg }, status);
}

async function hashEndpoint(endpoint: string): Promise<string> {
	const buf = new TextEncoder().encode(endpoint);
	const digest = await crypto.subtle.digest('SHA-256', buf);
	const bytes = new Uint8Array(digest);
	return Array.from(bytes.subarray(0, 16))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function getVapidKeys(env: Env): VapidKeys {
	return {
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY,
		subject: env.VAPID_SUBJECT
	};
}

// --------------------------------------------------------------- schema validation

interface SubscribeBody {
	subscription: {
		endpoint: string;
		keys: { p256dh: string; auth: string };
	};
	schedule: {
		wakeUpTime: string;
		sleepHours: number;
		intensityPreference: 'light' | 'medium' | 'hard';
		tzOffsetMinutes: number;
	};
}

function validateSubscribeBody(b: unknown): string | SubscribeBody {
	if (!b || typeof b !== 'object') return 'Body must be JSON object';
	const body = b as Record<string, unknown>;
	const sub = body.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
	if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return 'Invalid subscription';
	const sched = body.schedule as Record<string, unknown>;
	if (!sched) return 'Missing schedule';
	if (typeof sched.wakeUpTime !== 'string' || !/^\d{2}:\d{2}$/.test(sched.wakeUpTime))
		return 'Invalid wakeUpTime (HH:MM)';
	if (typeof sched.sleepHours !== 'number' || sched.sleepHours < 3 || sched.sleepHours > 14)
		return 'Invalid sleepHours';
	if (
		sched.intensityPreference !== 'light' &&
		sched.intensityPreference !== 'medium' &&
		sched.intensityPreference !== 'hard'
	)
		return 'Invalid intensityPreference';
	if (
		typeof sched.tzOffsetMinutes !== 'number' ||
		sched.tzOffsetMinutes < -840 ||
		sched.tzOffsetMinutes > 840
	)
		return 'Invalid tzOffsetMinutes';
	return body as unknown as SubscribeBody;
}

// --------------------------------------------------------------- endpoints

async function handleSubscribe(req: Request, env: Env): Promise<Response> {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return errorResponse(env, 'Invalid JSON');
	}
	const validated = validateSubscribeBody(body);
	if (typeof validated === 'string') return errorResponse(env, validated);

	const id = await hashEndpoint(validated.subscription.endpoint);
	const now = Date.now();

	await env.DB.prepare(
		`INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, wake_up_time, sleep_hours, intensity_preference, tz_offset_minutes, created_at, updated_at)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
		 ON CONFLICT(endpoint) DO UPDATE SET
			p256dh = excluded.p256dh,
			auth = excluded.auth,
			wake_up_time = excluded.wake_up_time,
			sleep_hours = excluded.sleep_hours,
			intensity_preference = excluded.intensity_preference,
			tz_offset_minutes = excluded.tz_offset_minutes,
			updated_at = excluded.updated_at`
	)
		.bind(
			id,
			validated.subscription.endpoint,
			validated.subscription.keys.p256dh,
			validated.subscription.keys.auth,
			validated.schedule.wakeUpTime,
			validated.schedule.sleepHours,
			validated.schedule.intensityPreference,
			validated.schedule.tzOffsetMinutes,
			now
		)
		.run();

	return jsonResponse(env, { id, ok: true });
}

async function handleUnsubscribe(req: Request, env: Env): Promise<Response> {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return errorResponse(env, 'Invalid JSON');
	}
	const endpoint = (body as { endpoint?: string }).endpoint;
	if (!endpoint) return errorResponse(env, 'Missing endpoint');
	const id = await hashEndpoint(endpoint);
	await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(id).run();
	await env.DB.prepare('DELETE FROM pending_messages WHERE subscription_id = ?').bind(id).run();
	return jsonResponse(env, { ok: true });
}

async function handleMessage(req: Request, env: Env): Promise<Response> {
	const url = new URL(req.url);
	const id = url.searchParams.get('id');
	if (!id) return errorResponse(env, 'Missing id');
	const row = await env.DB.prepare(
		'SELECT title, body, url FROM pending_messages WHERE subscription_id = ?'
	)
		.bind(id)
		.first<{ title: string; body: string; url: string }>();
	if (!row) {
		return jsonResponse(env, {
			title: 'Iltavahti',
			body: 'Aika rauhoittua.',
			url: env.CORS_ORIGIN || '/'
		});
	}
	// Consume: delete after read so next push lookup is fresh
	await env.DB.prepare('DELETE FROM pending_messages WHERE subscription_id = ?').bind(id).run();
	return jsonResponse(env, row);
}

async function handleVapidPublic(env: Env): Promise<Response> {
	return jsonResponse(env, { publicKey: env.VAPID_PUBLIC_KEY });
}

async function handleHealth(env: Env): Promise<Response> {
	return jsonResponse(env, { ok: true, ts: Date.now() });
}

// --------------------------------------------------------------- router

async function route(req: Request, env: Env): Promise<Response> {
	if (req.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders(env) });
	}

	const url = new URL(req.url);
	const key = `${req.method} ${url.pathname}`;
	switch (key) {
		case 'POST /subscribe':
			return handleSubscribe(req, env);
		case 'DELETE /subscribe':
			return handleUnsubscribe(req, env);
		case 'GET /message':
			return handleMessage(req, env);
		case 'GET /vapid-public':
			return handleVapidPublic(env);
		case 'GET /health':
			return handleHealth(env);
		default:
			return errorResponse(env, 'Not found', 404);
	}
}

// --------------------------------------------------------------- cron

interface SubRow {
	id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	wake_up_time: string;
	sleep_hours: number;
	intensity_preference: string;
	tz_offset_minutes: number;
}

// Reminder slots (minutes before local bedtime)
const SLOTS: { key: SlotKey; minutesBefore: number; gateByIntensity?: boolean }[] = [
	{ key: 'pre2h', minutesBefore: 120, gateByIntensity: true }, // skipped for 'light'
	{ key: 'pre1h', minutesBefore: 60 },
	{ key: 'pre30', minutesBefore: 30 },
	{ key: 'now', minutesBefore: 0 }
];

function localMinutesNow(nowUtcMs: number, tzOffsetMinutes: number): number {
	const localMs = nowUtcMs + tzOffsetMinutes * 60_000;
	const d = new Date(localMs);
	return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function bedtimeLocalMinutes(wakeUpTime: string, sleepHours: number): number {
	const [wh, wm] = wakeUpTime.split(':').map(Number);
	const total = wh * 60 + wm - Math.round(sleepHours * 60);
	return ((total % (24 * 60)) + 24 * 60) % (24 * 60);
}

async function wasSentThisSlot(
	db: D1Database,
	subId: string,
	slot: SlotKey,
	nowMs: number
): Promise<boolean> {
	const since = nowMs - 23 * 3600 * 1000;
	const row = await db
		.prepare(
			'SELECT 1 FROM delivery_log WHERE subscription_id = ? AND reminder_slot = ? AND sent_at > ? LIMIT 1'
		)
		.bind(subId, slot, since)
		.first();
	return !!row;
}

async function logDelivery(
	db: D1Database,
	subId: string,
	slot: SlotKey,
	nowMs: number,
	success: boolean,
	message: string
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO delivery_log (subscription_id, reminder_slot, sent_at, success, message) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(subId, slot, nowMs, success ? 1 : 0, message)
		.run();
}

async function stagePendingMessage(
	db: D1Database,
	subId: string,
	msg: Message,
	url: string,
	nowMs: number
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO pending_messages (subscription_id, title, body, url, created_at)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(subscription_id) DO UPDATE SET
				title = excluded.title,
				body = excluded.body,
				url = excluded.url,
				created_at = excluded.created_at`
		)
		.bind(subId, msg.title, msg.body, url, nowMs)
		.run();
}

async function runCron(env: Env): Promise<void> {
	const nowMs = Date.now();
	const dayKey = dayOfYearUTC(new Date(nowMs));

	const subs = await env.DB.prepare('SELECT * FROM push_subscriptions').all<SubRow>();
	if (!subs.results || subs.results.length === 0) return;

	const keys = getVapidKeys(env);
	const appUrl = env.CORS_ORIGIN || '/';

	for (const sub of subs.results) {
		const nowLocalMin = localMinutesNow(nowMs, sub.tz_offset_minutes);
		const bedMin = bedtimeLocalMinutes(sub.wake_up_time, sub.sleep_hours);

		for (const slot of SLOTS) {
			const targetMin = (bedMin - slot.minutesBefore + 24 * 60) % (24 * 60);
			// Match within a 1-minute window (cron fires once a minute)
			const diff = Math.abs(nowLocalMin - targetMin);
			const wrapDiff = Math.min(diff, 24 * 60 - diff);
			if (wrapDiff !== 0) continue;

			if (slot.gateByIntensity && sub.intensity_preference === 'light') continue;

			if (await wasSentThisSlot(env.DB, sub.id, slot.key, nowMs)) continue;

			const msg = pickMessage(slot.key, dayKey + slot.minutesBefore);
			await stagePendingMessage(env.DB, sub.id, msg, appUrl, nowMs);

			const subscription: PushSubscription = {
				endpoint: sub.endpoint,
				p256dh: sub.p256dh,
				auth: sub.auth
			};

			let ok = false;
			let statusText = '';
			try {
				const result = await sendEmptyPush(keys, subscription);
				ok = result.ok;
				statusText = `${result.status}${result.error ? ': ' + result.error.slice(0, 200) : ''}`;
				if (result.expired) {
					await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?')
						.bind(sub.id)
						.run();
				}
			} catch (err) {
				statusText = String(err).slice(0, 200);
			}

			await logDelivery(env.DB, sub.id, slot.key, nowMs, ok, statusText);
		}
	}
}

// --------------------------------------------------------------- worker export

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		try {
			return await route(req, env);
		} catch (err) {
			return errorResponse(env, String(err), 500);
		}
	},

	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(runCron(env));
	}
};
