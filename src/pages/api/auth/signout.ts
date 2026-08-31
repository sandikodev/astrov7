export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ session, redirect }) => {
	if (session) session.destroy();
	return redirect('/auth');
};

export const POST: APIRoute = async ({ session }) => {
	if (session) session.destroy();
	return new Response(JSON.stringify({ success: true, message: 'Signed out' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};

