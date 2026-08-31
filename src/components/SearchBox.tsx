import { useEffect, useRef, useState } from 'preact/hooks';

interface SearchItem {
	id: number;
	title: string;
	completed: boolean;
}

interface SearchPayload {
	query: string;
	source: string;
	hits: number;
	serverTime: string;
	items: SearchItem[];
	error?: string;
}

type Status = 'idle' | 'loading' | 'error' | 'success';

export default function SearchBox() {
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState<Status>('idle');
	const [data, setData] = useState<SearchPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const debounceRef = useRef<number>(0);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		return () => abortRef.current?.abort();
	}, []);

	function runSearch(value: string) {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setStatus('loading');

		fetch(`/api/search?q=${encodeURIComponent(value)}`, {
			signal: controller.signal,
			headers: { Accept: 'application/json' },
		})
			.then((response) => {
				if (!response.ok) throw new Error(`Upstream replied HTTP ${response.status}`);
				return response.json() as Promise<SearchPayload>;
			})
			.then((payload) => {
				if (payload.error) throw new Error(payload.error);
				setData(payload);
				setError(null);
				setStatus('success');
			})
			.catch((err: unknown) => {
				if (err instanceof Error && err.name === 'AbortError') return;
				setError(err instanceof Error ? err.message : 'Request failed');
				setStatus('error');
			});
	}

	function onInput(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		setQuery(value);
		clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			const q = value.trim();
			if (q.length === 0) {
				abortRef.current?.abort();
				setData(null);
				setStatus('idle');
				return;
			}
			runSearch(q);
		}, 300) as unknown as number;
	}

	return (
		<div class="space-y-4">
			<div class="relative">
				<input
					type="search"
					value={query}
					onInput={onInput}
					placeholder="Search todos (300ms debounced)…"
					class="w-full rounded-lg border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 pr-28 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition min-h-[40px]"
				/>
				{status === 'loading' && (
					<span class="absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-mono text-zinc-400">
						searching…
					</span>
				)}
			</div>

			{status === 'error' && (
				<p class="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
					{error}
				</p>
			)}

			{status === 'success' && data && (
				<div class="space-y-2.5">
					<div class="flex items-center justify-between text-xs text-zinc-400 font-mono">
						<span>{data.hits} result{data.hits === 1 ? '' : 's'} for “{data.query}”</span>
						<span class="text-zinc-300">{data.source}</span>
					</div>

					<ul class="space-y-2">
						{data.items.length === 0 && (
							<li class="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
								No matches. Try searching for “eat” or “voluptatem”.
							</li>
						)}
						{data.items.map((item) => (
							<li
								key={item.id}
								class="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 text-xs sm:text-sm"
							>
								<span
									class={
										item.completed
											? 'flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 font-bold text-xs text-white border border-zinc-700'
											: 'flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-900 text-xs text-zinc-600 border border-zinc-800'
									}
								>
									{item.completed ? '✓' : ''}
								</span>
								<span class={item.completed ? 'text-zinc-500 line-through' : 'text-zinc-200 font-medium'}>
									{item.title}
								</span>
								<span class="ml-auto font-mono text-xs text-zinc-600">#{item.id}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 text-xs text-zinc-400 leading-relaxed">
				<strong class="text-zinc-200 font-mono">Client Island Hygiene:</strong> AbortController cancels stale requests, 300ms debounce defers execution, explicit loading/error/empty UI states handled cleanly.
			</div>
		</div>
	);
}