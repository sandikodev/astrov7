import type { MiddlewareHandler } from 'astro';
import { getUserProfile } from '@lib/neon';

export const onRequest: MiddlewareHandler = async (context, next) => {
	const startTime = performance.now();
	const { url, redirect, locals, request, session } = context;
	const pathname = url.pathname;

	// Read session from native Astro session
	let userId: string | undefined;
	if (session) {
		userId = await session.get('userId');
	}

	if (userId) {
		const userProfile = await getUserProfile(userId);
		
		if (userProfile) {
			locals.user = {
				id: userProfile.id,
				name: userProfile.name,
				email: userProfile.email,
				role: userProfile.role,
				...(userProfile.avatarUrl ? { avatarUrl: userProfile.avatarUrl } : {}),
			};
			locals.session = { id: 'kv-session', userId: userProfile.id };
		} else {
			locals.user = null;
			locals.session = null;
			if (session) session.destroy();
		}
	} else {
		locals.user = null;
		locals.session = null;
	}

	// Protect all /app/* routes via middleware
	if (pathname.startsWith('/app')) {
		if (!locals.user) {
			return redirect(`/auth?redirect=${encodeURIComponent(pathname)}`);
		}
	}

	// Execute downstream route handler
	const response = await next();
	const ssrTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

	// Populate server trace telemetry metadata for DevTraceConsole component
	const cf = (request as unknown as { cf?: IncomingRequestCfProperties }).cf;
	locals.serverTrace = {
		cfRayId: request.headers.get('cf-ray') || `cf-ray-${Math.random().toString(36).substring(2, 9)}`,
		coloLocation: cf?.colo || request.headers.get('cf-ipcountry') || 'CGK (Jakarta)',
		ssrTimeMs,
		sessionStatus: locals.user ? `Authenticated (${locals.user.name})` : 'Unauthenticated',
		neonBranchUrl: import.meta.env.PUBLIC_NEON_DATA_API_URL || import.meta.env.VITE_NEON_DATA_API_URL || 'https://ep-billowing-math-aymuolsm.apirest.c-5.us-east-2.aws.neon.tech/neondb/rest/v1',
		neonAuthUrl: import.meta.env.PUBLIC_NEON_AUTH_URL || import.meta.env.VITE_NEON_AUTH_URL || 'https://ep-billowing-math-aymuolsm.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth',
		routePath: pathname,
		prerender: false,
	};

	return response;
};
