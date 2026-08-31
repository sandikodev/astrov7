export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ cookies, redirect }) => {
	cookies.delete('astrov7-session', { path: '/' });
	cookies.delete('astro_v7_session', { path: '/' });
	return redirect('/auth');
};

export const POST: APIRoute = async ({ cookies }) => {
	cookies.delete('astrov7-session', { path: '/' });
	cookies.delete('astro_v7_session', { path: '/' });
	return new Response(JSON.stringify({ success: true, message: 'Signed out' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
