import type { APIRoute } from 'astro';
import { registerSseClient, unregisterSseClient } from '@/lib/telemetry';

export const prerender = false;

export const GET: APIRoute = async () => {
	let clientController: ReadableStreamDefaultController | null = null;
	let heartbeatTimer: any = null;

	const stream = new ReadableStream({
		start(controller) {
			clientController = controller;
			registerSseClient(controller);

			const encoder = new TextEncoder();

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

			controller.enqueue(encoder.encode(pingData));

			// Send periodic heartbeat comment every 15s to keep Workers isolate active
			heartbeatTimer = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': heartbeat\n\n'));
				} catch {
					clearInterval(heartbeatTimer);
				}
			}, 15000);
		},
		cancel() {
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
			}
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
