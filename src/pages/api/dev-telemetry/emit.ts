import type { APIRoute } from 'astro';
import { broadcastServerTelemetry } from '@lib/telemetry';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	// Session Guard
	const sessionToken = cookies.get('astrov7-session')?.value || cookies.get('astro_v7_session')?.value;
	if (!sessionToken) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Valid session required to emit dev telemetry' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const payload: any = await request.json();
		const { tab, level, title, summary, detail } = payload || {};

		if (!tab || !title) {
			return new Response(JSON.stringify({ error: 'Missing tab or title' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const broadcasted = broadcastServerTelemetry({
			tab,
			level: level || 'info',
			title,
			summary: summary || '',
			detail: detail || {},
		});

		return new Response(JSON.stringify({ success: true, broadcasted }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ error: err.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
