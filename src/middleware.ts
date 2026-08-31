import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (context, next) => {
	const startTime = performance.now();
	const { url, cookies, redirect, locals, request } = context;
	const pathname = url.pathname;

	// Read session cookie (aligned with astro.config.mjs astrov7-session)
	const sessionToken = cookies.get('astrov7-session')?.value || cookies.get('astro_v7_session')?.value;

	if (sessionToken) {
		locals.user = {
			id: 'usr_dev_01',
			name: 'Astro Developer',
			email: 'dev@astrov7.community',
			role: 'admin',
			avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
		};
		locals.session = { id: sessionToken, userId: 'usr_dev_01' };
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
