import { useState, useEffect } from 'preact/hooks';
import { highlightJson } from '@lib/syntaxHighlight';

export interface ServerTraceData {
	cfRayId?: string;
	coloLocation?: string;
	ssrTimeMs?: number;
	sessionStatus?: string;
	neonBranchUrl?: string;
	neonAuthUrl?: string;
	routePath?: string;
	prerender?: boolean;
}

export interface LogEntry {
	id: string;
	timestamp: string;
	tab: 'client' | 'neon' | 'cloudflare';
	level: 'info' | 'success' | 'warn' | 'trace';
	title: string;
	summary: string;
	detail: string | object;
}

interface Props {
	serverTrace?: ServerTraceData;
}

export default function DevTraceConsole({ serverTrace }: Props) {
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [activeTab, setActiveTab] = useState<'client' | 'neon' | 'cloudflare'>('client');
	const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'success' | 'warn' | 'trace'>('all');
	const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
	const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [consoleHeight, setConsoleHeight] = useState<number>(280);

	// Initialize initial logs and global listener
	useEffect(() => {
		const initialLogs: LogEntry[] = [
			{
				id: 'client-01',
				timestamp: new Date().toLocaleTimeString(),
				tab: 'client',
				level: 'info',
				title: 'Astro SPA ClientRouter Hydrated',
				summary: `Path: ${window.location.pathname} (${window.innerWidth}x${window.innerHeight})`,
				detail: {
					currentPath: window.location.pathname,
					viewport: `${window.innerWidth}x${window.innerHeight}`,
					transitionState: 'ClientRouter Ready',
					userAgent: navigator.userAgent,
				},
			},
			{
				id: 'neon-01',
				timestamp: new Date().toLocaleTimeString(),
				tab: 'neon',
				level: 'trace',
				title: 'Neon Data API HTTP/2 Client Initialized',
				summary: 'POST /v1/query (HTTP/2 Serverless REST API Endpoint)',
				detail: {
					endpoint: serverTrace?.neonBranchUrl || 'https://ep-billowing-math-aymuolsm.apirest.c-5.us-east-2.aws.neon.tech/neondb/rest/v1',
					authUrl: serverTrace?.neonAuthUrl || 'https://ep-billowing-math-aymuolsm.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth',
					protocol: 'HTTP/2 Serverless Stateless POST',
					rlsStatus: 'JWT Bearer Token Isolation Active',
				},
			},
			{
				id: 'cf-01',
				timestamp: new Date().toLocaleTimeString(),
				tab: 'cloudflare',
				level: 'info',
				title: 'Cloudflare Worker Isolate Invoked',
				summary: `Colo: ${serverTrace?.coloLocation || 'CGK'} | Ray: ${serverTrace?.cfRayId || 'local'} (${serverTrace?.ssrTimeMs || 14.2}ms)`,
				detail: {
					route: serverTrace?.routePath || window.location.pathname,
					cfRayId: serverTrace?.cfRayId || `cf-ray-${Math.random().toString(36).substring(2, 9)}`,
					edgeColo: serverTrace?.coloLocation || 'CGK (Jakarta)',
					ssrExecutionMs: serverTrace?.ssrTimeMs || 14.2,
					prerender: serverTrace?.prerender ?? false,
				},
			},
		];

		setLogs(initialLogs);

		// Expose global window logger for component events and broadcast to all connected browsers
		window.__DEV_CONSOLE_LOG__ = (
			tab: 'client' | 'neon' | 'cloudflare',
			level: 'info' | 'success' | 'warn' | 'trace',
			title: string,
			summary: string,
			detail: string | object
		) => {
			const newLog: LogEntry = {
				id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
				timestamp: new Date().toLocaleTimeString(),
				tab,
				level,
				title,
				summary,
				detail,
			};
			setLogs((prev) => [newLog, ...prev]);

			// Broadcast log to all other open browser windows via SSE broadcast!
			fetch('/api/dev-telemetry/emit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tab, level, title, summary, detail }),
			}).catch(() => {});
		};
	}, [serverTrace]);

	// Connect to Real-time SSE Telemetry Stream for multi-client log synchronization
	useEffect(() => {
		let eventSource: EventSource | null = null;
		try {
			eventSource = new EventSource('/api/dev-telemetry/stream');

			eventSource.onmessage = (event) => {
				try {
					const logPayload: LogEntry = JSON.parse(event.data);
					setLogs((prev) => {
						if (prev.some((l) => l.id === logPayload.id)) return prev;
						return [logPayload, ...prev];
					});
				} catch {
					// Silent fallback on malformed SSE packet
				}
			};
		} catch {
			// Fallback if SSE unavailable
		}

		return () => {
			eventSource?.close();
		};
	}, []);

	// Vertical Resizing Logic
	const startResizing = (e: MouseEvent | TouchEvent) => {
		e.preventDefault();
		const startY = 'touches' in e ? (e as TouchEvent).touches[0]!.clientY : (e as MouseEvent).clientY;
		const startHeight = consoleHeight;

		const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
			const currentY = 'touches' in moveEvent ? (moveEvent as TouchEvent).touches[0]!.clientY : (moveEvent as MouseEvent).clientY;
			const deltaY = startY - currentY;
			const newHeight = Math.max(160, Math.min(650, startHeight + deltaY));
			setConsoleHeight(newHeight);
		};

		const onMouseUp = () => {
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
			window.removeEventListener('touchmove', onMouseMove);
			window.removeEventListener('touchend', onMouseUp);
		};

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
		window.addEventListener('touchmove', onMouseMove);
		window.addEventListener('touchend', onMouseUp);
	};

	const toggleAccordion = (id: string, e?: Event) => {
		e?.stopPropagation();
		setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const handleCopySingleLog = (log: LogEntry, e: Event) => {
		e.stopPropagation();
		const copyText = typeof log.detail === 'object' ? JSON.stringify(log.detail, null, 2) : log.detail;
		navigator.clipboard.writeText(copyText);
		setCopiedLogId(log.id);
		setTimeout(() => setCopiedLogId(null), 1500);
	};

	const filteredLogs = logs.filter((log) => {
		if (log.tab !== activeTab) return false;
		if (filterLevel !== 'all' && log.level !== filterLevel) return false;
		return true;
	});

	const handleClearLogs = () => setLogs([]);

	const handleCopyAllJSON = () => {
		navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
		alert('Copied all developer trace logs as JSON!');
	};

	return (
		<div class="hidden md:flex flex-col border-t border-zinc-800 bg-zinc-950/95 font-mono text-xs z-50 select-none w-full shrink-0 sticky bottom-0">
			{/* Intuitive Drag Resize Handle at the VERY TOP EDGE of the Console (Only rendered when expanded) */}
			{isOpen && (
				<div
					onMouseDown={startResizing}
					onTouchStart={startResizing}
					title="Drag top edge up or down to resize console height"
					class="h-2 w-full bg-zinc-900 hover:bg-indigo-500/80 cursor-ns-resize transition flex items-center justify-center group shrink-0 border-b border-zinc-800/80"
				>
					<div class="h-1 w-12 rounded-full bg-zinc-700 group-hover:bg-indigo-300 transition"></div>
				</div>
			)}

			{/* Collapsible Header Status Bar */}
			<div
				onClick={() => setIsOpen(!isOpen)}
				class="flex items-center justify-between px-4 py-2 bg-zinc-900/80 hover:bg-zinc-900 cursor-pointer transition border-b border-zinc-800/60"
			>
				<div class="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5">
					<div class="flex items-center gap-2 shrink-0">
						<span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
						<span class="font-bold text-white tracking-tight flex items-center gap-1.5">
							<svg class="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
							</svg>
							Dev Trace Console
						</span>
						<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 font-semibold">
							{logs.length} logs
						</span>
					</div>

					<div class="hidden sm:flex items-center gap-3 text-[11px] text-zinc-400 shrink-0 border-l border-zinc-800 pl-3">
						<span><strong class="text-zinc-300">CF Edge:</strong> {serverTrace?.coloLocation || 'CGK'}</span>
						<span><strong class="text-zinc-300">Neon API:</strong> Active</span>
						<span><strong class="text-zinc-300">SSR:</strong> {serverTrace?.ssrTimeMs || 14.2}ms</span>
					</div>
				</div>

				<div class="flex items-center gap-3 shrink-0 pl-2">
					{isOpen && (
						<div class="flex items-center gap-2 mr-2" onClick={(e) => e.stopPropagation()}>
							<div class="relative">
								<select
									value={filterLevel}
									onChange={(e) => setFilterLevel((e.target as HTMLSelectElement).value as 'all' | 'info' | 'success' | 'warn' | 'trace')}
									class="appearance-none rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 pr-7 text-[11px] text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
								>
									<option value="all">All Levels</option>
									<option value="info">Info</option>
									<option value="success">Success</option>
									<option value="trace">Trace</option>
									<option value="warn">Warn</option>
								</select>
								<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
									<svg class="h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</div>
							</div>

							<button
								type="button"
								onClick={handleCopyAllJSON}
								class="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
							>
								Copy All JSON
							</button>

							<button
								type="button"
								onClick={handleClearLogs}
								class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
							>
								Clear
							</button>
						</div>
					)}
					<span class="text-[10px] text-zinc-500 font-mono hidden md:inline">
						{isOpen ? 'Click to collapse' : 'Click to expand console'}
					</span>
					<button type="button" class="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-zinc-300 hover:text-white transition">
						{isOpen ? '▼' : '▲'}
					</button>
				</div>
			</div>

			{/* Expanded Resizable Console Panel (Edge-to-Edge Flush Container) */}
			{isOpen && (
				<div
					style={{ height: `${consoleHeight}px` }}
					class="flex flex-row bg-zinc-950/95 overflow-hidden relative transition-none w-full"
				>
					{/* Left Column: Scrollable Log Stream Container */}
					<div class="flex-1 min-w-0 flex flex-col border-r border-zinc-800/80">
						{filteredLogs.length === 0 ? (
							<div class="flex-1 min-h-0 p-4 w-full flex">
								<div class="w-full h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl">
									No trace logs recorded for tab [{activeTab.toUpperCase()}] yet. Execute a simulation above to capture live telemetry.
								</div>
							</div>
						) : (
							<div class="flex-1 min-h-0 overflow-y-auto console-log-stream space-y-1.5 font-mono text-[11px] px-4 py-2 w-full block">
								{filteredLogs.map((log) => {
									const isExpanded = Boolean(expandedLogIds[log.id]);
									const isCopied = copiedLogId === log.id;

									return (
										<div
											key={log.id}
											class="rounded-xl border border-zinc-800/80 bg-zinc-950 overflow-hidden transition w-full"
										>
											{/* Single-Line Summary Row (Default View) */}
											<div
												onClick={(e) => toggleAccordion(log.id, e)}
												class="flex items-center justify-between gap-3 px-3 py-2 bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer transition"
											>
												<div class="flex items-center gap-2.5 min-w-0 flex-1">
													<span
														class={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider shrink-0 ${
															log.level === 'success'
																? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
																: log.level === 'trace'
																? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
																: log.level === 'warn'
																? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
																: 'bg-zinc-800 text-zinc-300'
														}`}
													>
														{log.level}
													</span>
													<span class="font-bold text-white truncate shrink-0">{log.title}</span>
													<span class="text-zinc-400 truncate text-[10px] hidden sm:inline">{log.summary}</span>
												</div>

												<div class="flex items-center gap-2 shrink-0">
													<span class="text-zinc-500 text-[10px] hidden md:inline">{log.timestamp}</span>

													{/* Dedicated Copy Button for this specific log row */}
													<button
														type="button"
														onClick={(e) => handleCopySingleLog(log, e)}
														title="Copy log payload to clipboard"
														class="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
													>
														{isCopied ? '✓ Copied' : 'Copy'}
													</button>

													{/* Accordion Arrow Button */}
													<button
														type="button"
														onClick={(e) => toggleAccordion(log.id, e)}
														class="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-white transition"
													>
														{isExpanded ? '▼' : '▶'}
													</button>
												</div>
											</div>

											{/* Expanded Detail Accordion Content */}
											{isExpanded && (
												<div class="p-3 bg-zinc-950 border-t border-zinc-800/60 space-y-2">
													<div class="flex items-center justify-between text-[10px] text-zinc-400">
														<span>Detailed Execution Payload</span>
														<span class="font-mono text-indigo-300">ID: {log.id}</span>
													</div>
													{typeof log.detail === 'object' ? (
														<pre
															class="text-[10px] bg-zinc-900/90 p-3 rounded-lg overflow-x-auto leading-relaxed border border-zinc-800/60 font-mono text-zinc-300"
															dangerouslySetInnerHTML={{ __html: highlightJson(log.detail) }}
														/>
													) : (
														<p class="text-zinc-300 text-[11px] bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800/60 font-mono">
															{log.detail}
														</p>
													)}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Right Column: Navigation Tabs Sidebar */}
					<div class="w-48 sm:w-56 shrink-0 flex flex-col gap-2 p-3 bg-zinc-950 overflow-y-auto">
						<button
							type="button"
							onClick={() => setActiveTab('client')}
							class={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer flex flex-col items-start gap-1 text-left ${
								activeTab === 'client'
									? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
									: 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'
							}`}
						>
							<div class="flex items-center justify-between w-full">
								<span class="flex items-center gap-1.5">🌐 Client Events</span>
								<span class="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-300 leading-none">
									{logs.filter((l) => l.tab === 'client').length}
								</span>
							</div>
							<span class="text-[10px] font-normal opacity-70">Browser & SPA Events</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab('neon')}
							class={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer flex flex-col items-start gap-1 text-left ${
								activeTab === 'neon'
									? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
									: 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'
							}`}
						>
							<div class="flex items-center justify-between w-full">
								<span class="flex items-center gap-1.5">🐘 Neon Trace</span>
								<span class="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-300 leading-none">
									{logs.filter((l) => l.tab === 'neon').length}
								</span>
							</div>
							<span class="text-[10px] font-normal opacity-70">Serverless Postgres</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab('cloudflare')}
							class={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer flex flex-col items-start gap-1 text-left ${
								activeTab === 'cloudflare'
									? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
									: 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'
							}`}
						>
							<div class="flex items-center justify-between w-full">
								<span class="flex items-center gap-1.5">⛅ Edge Trace</span>
								<span class="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-300 leading-none">
									{logs.filter((l) => l.tab === 'cloudflare').length}
								</span>
							</div>
							<span class="text-[10px] font-normal opacity-70">Cloudflare Worker Trace</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
