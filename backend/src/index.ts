// Iltavahti Cloudflare Worker – API-backend

export interface Env {
	DB: D1Database;
	VAPID_PUBLIC_KEY: string;
	VAPID_PRIVATE_KEY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const cors = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: cors });
		}

		try {
			// Asetukset
			if (url.pathname === '/api/settings' && request.method === 'GET') {
				const row = await env.DB.prepare('SELECT * FROM settings WHERE id = ?').bind('default').first();
				return Response.json(row ?? {}, { headers: cors });
			}

			if (url.pathname === '/api/settings' && request.method === 'PUT') {
				const body = await request.json<Record<string, unknown>>();
				await env.DB.prepare(
					`INSERT INTO settings (id, wake_time, sleep_hours, intensity, updated_at)
					 VALUES ('default', ?, ?, ?, datetime('now'))
					 ON CONFLICT(id) DO UPDATE SET
					   wake_time = excluded.wake_time,
					   sleep_hours = excluded.sleep_hours,
					   intensity = excluded.intensity,
					   updated_at = datetime('now')`
				).bind(
					body.wake_time ?? '07:00',
					body.sleep_hours ?? 7,
					body.intensity ?? 'medium'
				).run();
				return Response.json({ ok: true }, { headers: cors });
			}

			// Suoritukset
			if (url.pathname === '/api/completions' && request.method === 'GET') {
				const rows = await env.DB.prepare(
					'SELECT completed_date FROM completions ORDER BY completed_date DESC LIMIT 30'
				).all();
				return Response.json(rows.results, { headers: cors });
			}

			if (url.pathname === '/api/completions' && request.method === 'POST') {
				const body = await request.json<{ date: string }>();
				await env.DB.prepare(
					'INSERT OR IGNORE INTO completions (completed_date) VALUES (?)'
				).bind(body.date).run();
				return Response.json({ ok: true }, { headers: cors });
			}

			// VAPID julkinen avain (frontend tarvitsee tämän)
			if (url.pathname === '/api/vapid-public-key') {
				return Response.json({ key: env.VAPID_PUBLIC_KEY }, { headers: cors });
			}

			// Push-tilaus
			if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
				const sub = await request.json<{ endpoint: string; keys: { p256dh: string; auth: string } }>();
				await env.DB.prepare(
					`INSERT INTO push_subscriptions (endpoint, p256dh, auth)
					 VALUES (?, ?, ?)
					 ON CONFLICT(endpoint) DO UPDATE SET
					   p256dh = excluded.p256dh,
					   auth = excluded.auth`
				).bind(sub.endpoint, sub.keys.p256dh, sub.keys.auth).run();
				return Response.json({ ok: true }, { headers: cors });
			}

			return Response.json({ error: 'Not found' }, { status: 404, headers: cors });
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			return Response.json({ error: msg }, { status: 500, headers: cors });
		}
	},
} satisfies ExportedHandler<Env>;
