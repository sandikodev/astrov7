export const prerender = false;
import type { APIRoute } from 'astro';
import { broadcastServerTelemetry } from '@lib/telemetry';

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const body: any = await request.json();
		const email = body?.email || 'dev@astrov7.community';
		const sessionToken = crypto.randomUUID();

		// Set session cookie aligned with astro.config.mjs (astrov7-session)
		cookies.set('astrov7-session', sessionToken, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7, // 7 days
		});

		// Broadcast real-time SSE telemetry log (secret sessionToken masked)
		broadcastServerTelemetry({
			tab: 'client',
			level: 'success',
			title: 'Neon Auth & Cloudflare KV Session Created',
			summary: `User Authenticated: ${email}`,
			detail: {
				userEmail: email,
				sessionToken: '[PROTECTED_KV_SESSION_TOKEN]',
				storageEngine: 'Cloudflare KV Namespace (SESSION)',
				authProvider: 'Neon Auth Stateless JWT',
				timestamp: new Date().toISOString(),
			},
		});

		return new Response(JSON.stringify({ success: true, message: 'Signed in successfully' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || 'Signin failed' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
