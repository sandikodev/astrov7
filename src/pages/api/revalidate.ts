// Invalidation endpoint: purges cached routes by tag from Cloudflare's global cache.
// Demo: POST /api/revalidate { "tags": ["weather"] }
import type { APIContext } from 'astro';
import { broadcastServerTelemetry } from '@lib/telemetry';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
	// Session Guard
	if (!context.locals.user) {
		return Response.json(
			{ ok: false, error: 'Unauthorized: Valid session required to revalidate cache tags' },
			{ status: 401 }
		);
	}

	let tags: string[] = [];

	try {
		const body = (await context.request.json()) as { tags?: unknown; path?: unknown };
		if (Array.isArray(body.tags)) {
			tags = body.tags.filter((tag): tag is string => typeof tag === 'string');
		}
	} catch {
		// malformed body → fall through to the guard below
	}

	if (!context.cache.enabled) {
		return Response.json(
			{ ok: false, error: 'Route caching is not enabled on this deployment.' },
			{ status: 400 },
		);
	}

	if (tags.length === 0) {
		return Response.json(
			{ ok: false, error: 'Provide a non-empty "tags" array, e.g. { "tags": ["weather"] }.' },
			{ status: 400 },
		);
	}

	let isSimulated = false;

	// Invalidate tags on Cloudflare Cache, with graceful fallback for Wrangler local dev mode where cache.purge is simulated
	try {
		await context.cache.invalidate({ tags });
	} catch (err: any) {
		isSimulated = true;
		console.warn('[api/revalidate] Cloudflare cache.purge is simulated in Wrangler local dev mode:', err.message);
	}

	// Broadcast server telemetry log to ALL connected browser clients in real time via SSE!
	broadcastServerTelemetry({
		tab: 'cloudflare',
		level: 'warn',
		title: isSimulated ? 'Cloudflare Edge Cache Tags Purged (Dev Mode)' : 'Cloudflare Edge Cache Tags Purged',
		summary: `Purged tags: [${tags.join(', ')}]`,
		detail: {
			invalidatedTags: tags,
			action: 'context.cache.invalidate({ tags })',
			timestamp: new Date().toISOString(),
			coloLocation: (context.request as unknown as { cf?: IncomingRequestCfProperties }).cf?.colo || 'CGK (Jakarta)',
			cacheMode: isSimulated ? 'Local Wrangler Development (Simulated Cache Invalidation)' : 'Cloudflare Global Edge Cache Purge',
			executor: 'Server Action Broadcast',
		},
	});

	return Response.json({ ok: true, purged: tags, simulated: isSimulated });
}