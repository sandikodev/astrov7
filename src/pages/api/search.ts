// On-demand API endpoint with route caching (Cloudflare CDN).
// Pattern: client island → /api/search → (route cache) → upstream JSONPlaceholder.
import type { APIContext } from 'astro';
import { fetchJsonWithTimeout } from '@lib/http';

export const prerender = false;

interface UpstreamTodo {
	id: number;
	title: string;
	completed: boolean;
}

interface SearchItem {
	id: number;
	title: string;
	completed: boolean;
}

interface SearchPayload {
	query: string;
	source: string;
	cached: boolean;
	serverTime: string;
	hits: number;
	items: SearchItem[];
	error?: string;
}

export async function GET(context: APIContext): Promise<Response> {
	const query = context.url.searchParams.get('q')?.trim() ?? '';

	const result = await fetchJsonWithTimeout<UpstreamTodo[]>(
		'https://jsonplaceholder.typicode.com/todos',
		{ timeoutMs: 8000 },
	);

	if (!result.ok) {
		context.cache.set({ maxAge: 60, swr: 30, tags: ['search'] });
		return Response.json({
			query,
			source: 'jsonplaceholder',
			cached: false,
			serverTime: new Date().toISOString(),
			hits: 0,
			items: [],
			error: result.error,
		} satisfies SearchPayload, {
			status: 502,
			headers: { 'Cache-Control': 'no-store' },
		});
	}

	const needle = query.toLowerCase();
	const items: SearchItem[] =
		needle.length === 0
			? []
			: result.data
					.filter((todo) => todo.title.toLowerCase().includes(needle))
					.slice(0, 12)
					.map(({ id, title, completed }) => ({ id, title, completed }));

	context.cache.set({ maxAge: 300, swr: 60, tags: ['search'] });

	return Response.json({
		query,
		source: 'jsonplaceholder',
		cached: false,
		serverTime: new Date().toISOString(),
		hits: items.length,
		items,
	} satisfies SearchPayload);
}