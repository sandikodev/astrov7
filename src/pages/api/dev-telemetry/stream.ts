import type { APIRoute } from 'astro';
import { registerSseClient, unregisterSseClient } from '@lib/telemetry';

export const prerender = false;

export const GET: APIRoute = async () => {
	let clientController: ReadableStreamDefaultController | null = null;

	const stream = new ReadableStream({
		start(controller) {
			clientController = controller;
			registerSseClient(controller);

			// Send initial handshake ping
			const pingData = `data: ${JSON.stringify({
				id: `ping-${Date.now()}`,
				timestamp: new Date().toLocaleTimeString(),
				tab: 'cloudflare',
				level: 'info',
				title: 'SSE Telemetry Channel Connected',
				summary: 'Real-time Cross-Client Log Synchronizer Active',
				detail: {
					status: 'Connected',
					protocol: 'Server-Sent Events (SSE)',
					transport: 'HTTP/2 Streaming',
				},
			})}\n\n`;

			controller.enqueue(new TextEncoder().encode(pingData));
		},
		cancel() {
			if (clientController) {
				unregisterSseClient(clientController);
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no',
		},
	});
};
