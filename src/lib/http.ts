export interface FetchResult<T> {
	ok: true;
	data: T;
}

export interface FetchError {
	ok: false;
	error: string;
}

export type FetchResultOrError<T> = FetchResult<T> | FetchError;

/**
 * Best-practice fetch wrapper for on-demand routes:
 * - hard timeout via AbortController (never hang the request)
 * - non-2xx responses surfaced as normalized errors, not silent corrupt data
 */
export async function fetchJsonWithTimeout<T>(
	url: string,
	{ timeoutMs = 8000, init }: { timeoutMs?: number; init?: RequestInit } = {},
): Promise<FetchResultOrError<T>> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, { ...init, signal: controller.signal });
		if (!response.ok) {
			return { ok: false, error: `Upstream responded ${response.status}: ${response.statusText}` };
		}
		const data = (await response.json()) as T;
		return { ok: true, data };
	} catch (error) {
		const reason = error instanceof Error && error.name === 'AbortError'
			? `Upstream timed out after ${timeoutMs}ms`
			: error instanceof Error
				? error.message
				: 'Unknown upstream error';
		return { ok: false, error: reason };
	} finally {
		clearTimeout(timer);
	}
}