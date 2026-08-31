export const prerender = false;
import type { APIRoute } from 'astro';
import { broadcastServerTelemetry } from '@lib/telemetry';
import { getUserProfileByEmail, createUserProfile } from '@lib/neon';

export const POST: APIRoute = async ({ request, session }) => {
	try {
		const body: any = await request.json();
		const email = body?.email || 'dev@astrov7.community';
		const name = body?.name || 'Astro Developer';
		// Prevent anonymous self-promotion to admin. Only allow member or developer.
		const requestedRole = body?.role || 'member';
		const role = requestedRole === 'admin' ? 'developer' : requestedRole;
		
		let user = await getUserProfileByEmail(email);
		let isNew = false;
		
		if (!user) {
			// Register new user on first signin
			user = await createUserProfile({
				id: `usr_${Date.now().toString(36)}`,
				email,
				name,
				role,
				department: 'Community',
				maxStorageMb: 256
			});
			isNew = true;
		}

		if (!session) {
			return new Response(JSON.stringify({ error: 'Astro Session is not available.' }), { status: 500 });
		}

		// Store user ID in Astro's native KV Session
		session.set('userId', user.id);

		broadcastServerTelemetry({
			tab: 'client',
			level: 'success',
			title: isNew ? 'Neon Auth - New Account Registered' : 'Neon Auth - User Authenticated',
			summary: `User Authenticated: ${email}`,
			detail: {
				userId: user.id,
				userEmail: email,
				role: user.role,
				storageEngine: 'Cloudflare KV Namespace (SESSION)',
				authProvider: 'Neon Auth Stateless JWT (Simulated)',
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

