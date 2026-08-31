// Invalidation endpoint: purges cached routes by tag from Cloudflare's global cache.
// Demo: POST /api/revalidate { "tags": ["weather"] }
import type { APIContext } from 'astro';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
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

	await context.cache.invalidate({ tags });
	return Response.json({ ok: true, purged: tags });
}