/**
 * Real-time Cross-Client SSE Telemetry Broadcaster for Cloudflare Workers & Astro 7
 */

export interface TelemetryLogPayload {
	id: string;
	timestamp: string;
	tab: 'client' | 'neon' | 'cloudflare';
	level: 'info' | 'success' | 'warn' | 'trace';
	title: string;
	summary: string;
	detail: string | object;
	originClientId?: string;
}

// In-memory set of active SSE ReadableStream controllers
const activeSseControllers = new Set<ReadableStreamDefaultController>();

export function registerSseClient(controller: ReadableStreamDefaultController) {
	activeSseControllers.add(controller);
}

export function unregisterSseClient(controller: ReadableStreamDefaultController) {
	activeSseControllers.delete(controller);
}

export function broadcastServerTelemetry(payload: Omit<TelemetryLogPayload, 'id' | 'timestamp'>) {
	const fullLog: TelemetryLogPayload = {
		id: `server-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
		timestamp: new Date().toLocaleTimeString(),
		...payload,
	};

	const dataString = `data: ${JSON.stringify(fullLog)}\n\n`;
	const encoder = new TextEncoder();
	const encodedData = encoder.encode(dataString);

	for (const controller of Array.from(activeSseControllers)) {
		try {
			controller.enqueue(encodedData);
		} catch (err) {
			activeSseControllers.delete(controller);
		}
	}

	return fullLog;
}
