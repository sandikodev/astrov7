import { useState } from 'preact/hooks';
import { highlightCode, highlightJson } from '@lib/syntaxHighlight';

interface UseCaseDemo {
	id: string;
	shortTitle: string;
	title: string;
	subtitle: string;
	tag: string;
	description: string;
	codeSnippet: string;
	simulatedLatency: string;
	httpPayload: Record<string, unknown>;
	httpResponse: Record<string, unknown>;
}

const USE_CASES: UseCaseDemo[] = [
	{
		id: 'edge-query',
		shortTitle: 'Edge SQL Query',
		title: 'Edge SQL Querying',
		subtitle: 'HTTP/2 SQL execution without TCP connection handshakes',
		tag: 'Edge Runtime',
		description:
			'Cloudflare Workers send SQL queries over standard HTTP/2 endpoints using @neondatabase/serverless. Replaces TCP TLS handshakes with instant stateless HTTP requests.',
		codeSnippet: `import { neon } from '@neondatabase/serverless';\n\nconst sql = neon(import.meta.env.DATABASE_URL);\n\n// Executed via single HTTP/2 fetch\nconst users = await sql\`SELECT id, name, role FROM user_profiles WHERE role = \${'admin'}\`;`,
		simulatedLatency: '12ms',
		httpPayload: {
			endpoint: 'https://ep-billowing-math.apirest.neon.tech/v1/query',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: { query: 'SELECT id, name, role FROM user_profiles WHERE role = $1', params: ['admin'] },
		},
		httpResponse: {
			status: 200,
			statusText: 'OK',
			executionTimeMs: 12,
			cfEdgeLocation: 'CGK (Jakarta)',
			data: [
				{ id: 'usr_dev_01', name: 'Astro Developer', role: 'admin' },
				{ id: 'usr_dev_02', name: 'Cloudflare Engineer', role: 'admin' },
			],
		},
	},
	{
		id: 'transaction-batching',
		shortTitle: 'Transaction Batching',
		title: 'Multi-Statement Transaction Batching',
		subtitle: 'Atomic SQL execution packaged into a single HTTP payload',
		tag: 'Transactions',
		description:
			'Execute multi-step database transactions (UPDATE + INSERT) in one HTTP roundtrip. Minimizes network overhead when modifying multiple tables at once.',
		codeSnippet: `const sql = neon(import.meta.env.DATABASE_URL);\n\n// Single HTTP payload containing atomic transaction statements\nconst [updatedUser, logEntry] = await sql.transaction([\n  sql\`UPDATE user_profiles SET max_storage_mb = 1024 WHERE id = \${userId}\`,\n  sql\`INSERT INTO audit_logs (user_id, action) VALUES (\${userId}, 'QUOTA_UPDATE')\`,\n]);`,
		simulatedLatency: '18ms',
		httpPayload: {
			endpoint: 'https://ep-billowing-math.apirest.neon.tech/v1/transaction',
			method: 'POST',
			body: {
				queries: [
					{ query: 'UPDATE user_profiles SET max_storage_mb = 1024 WHERE id = $1', params: ['usr_dev_01'] },
					{ query: 'INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)', params: ['usr_dev_01', 'QUOTA_UPDATE'] },
				],
			},
		},
		httpResponse: {
			status: 200,
			transaction: 'COMMITTED',
			affectedRows: [1, 1],
			executionTimeMs: 18,
		},
	},
	{
		id: 'webhook-ingestion',
		shortTitle: 'Webhook Ingestion',
		title: 'Event & Webhook Recording',
		subtitle: 'Stateless event persistence for Stripe or Auth0 callbacks',
		tag: 'Webhooks',
		description:
			'Edge webhook handlers require immediate execution. Neon Data API logs incoming webhook payloads directly to Postgres without pool connection limits.',
		codeSnippet: `export async function POST({ request }) {\n  const payload = await request.json();\n  const sql = neon(import.meta.env.DATABASE_URL);\n\n  await sql\`INSERT INTO webhook_logs (event_type, payload) VALUES (\${payload.type}, \${JSON.stringify(payload)})\`;\n  return new Response(JSON.stringify({ received: true }), { status: 200 });\n}`,
		simulatedLatency: '9ms',
		httpPayload: {
			event: 'payment_intent.succeeded',
			amount: 4900,
			currency: 'usd',
			customer: 'cus_NfZ9028',
		},
		httpResponse: {
			status: 200,
			insertedId: 'evt_stripe_9921',
			ingestedAt: new Date().toISOString(),
			executionTimeMs: 9,
		},
	},
	{
		id: 'client-rls',
		shortTitle: 'Client RLS Query',
		title: 'Browser Fetch with Neon Auth & RLS',
		subtitle: 'Direct browser queries authorized by Row-Level Security policies',
		tag: 'Neon Auth',
		description:
			'Client islands fetch directly from Neon Data API using user bearer tokens. Postgres Row-Level Security (RLS) policies enforce row isolation automatically.',
		codeSnippet: `import { createClient } from '@neondatabase/neon-js';\nimport { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';\n\nexport const neon = createClient({\n  auth: { url: import.meta.env.VITE_NEON_AUTH_URL, adapter: BetterAuthReactAdapter() },\n  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL }\n});\n\n// Token attached automatically; RLS filters user rows\nconst { data: todos } = await neon.from('todos').select('*');`,
		simulatedLatency: '24ms',
		httpPayload: {
			headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
			query: 'SELECT * FROM todos',
			rlsContext: 'auth.uid() = usr_dev_01',
		},
		httpResponse: {
			status: 200,
			rlsPolicyApplied: 'user_isolation_policy',
			returnedRows: 3,
			executionTimeMs: 24,
		},
	},
	{
		id: 'branching-query',
		shortTitle: 'Branching Query',
		title: 'Isolated Database Branch Querying',
		subtitle: 'Environment routing for preview deployments and staging',
		tag: 'Branching',
		description:
			'Query isolated Postgres database branches dynamically during CI/CD previews without modifying persistent connection pools or restarting servers.',
		codeSnippet: `// Dynamic branch endpoint selection via request header\nconst branchUrl = request.headers.get('x-neon-branch-url') || process.env.PUBLIC_NEON_DATA_API_URL;\nconst sql = neon(branchUrl);\n\nconst flags = await sql\`SELECT * FROM feature_flags\`;`,
		simulatedLatency: '15ms',
		httpPayload: {
			branchName: 'preview/pr-142-rbac',
			endpoint: 'https://ep-preview-142.apirest.neon.tech/v1/query',
		},
		httpResponse: {
			status: 200,
			branch: 'preview/pr-142-rbac',
			isolatedState: true,
			executionTimeMs: 15,
		},
	},
];

export default function NeonDataApiShowcase() {
	const [activeCaseId, setActiveCaseId] = useState<string>('edge-query');
	const [isExecuting, setIsExecuting] = useState<boolean>(false);
	const [executionLog, setExecutionLog] = useState<string | null>(null);

	const activeCase = USE_CASES.find((c) => c.id === activeCaseId) || USE_CASES[0]!;

	const handleRunSimulation = () => {
		setIsExecuting(true);
		setExecutionLog(null);
		const startMs = performance.now();

		setTimeout(() => {
			setIsExecuting(false);
			const realMs = Math.round((performance.now() - startMs) * 10) / 10;
			const latencyStr = `${realMs}ms`;
			const logMsg = `[${new Date().toLocaleTimeString()}] Executed HTTP fetch via Neon Data API (${latencyStr})`;
			setExecutionLog(logMsg);

			// Emit telemetry traces to all relevant tabs in DevTraceConsole
			if (typeof window !== 'undefined' && window.__DEV_CONSOLE_LOG__) {
				// 1. Client Event
				window.__DEV_CONSOLE_LOG__(
					'client',
					'info',
					`Client Invoked: ${activeCase.shortTitle}`,
					`HTTP POST /v1/query (${latencyStr})`,
					{
						action: 'SIMULATE_HTTP_FETCH',
						useCase: activeCase.id,
						measuredLatency: latencyStr,
						initiator: 'Preact Island UI Button',
					}
				);

				// 2. Neon Serverless Event
				window.__DEV_CONSOLE_LOG__(
					'neon',
					'success',
					`Neon Postgres Data API: ${activeCase.shortTitle}`,
					`200 OK (${latencyStr}) - SQL Execution Committed`,
					{
						endpoint: (activeCase.httpPayload.endpoint as string) || 'https://ep-billowing-math.apirest.neon.tech/v1/query',
						protocol: 'HTTP/2 Serverless POST',
						requestPayload: activeCase.httpPayload,
						responseJSON: activeCase.httpResponse,
						executionTimeMs: realMs,
					}
				);

				// 3. Cloudflare Edge Event
				window.__DEV_CONSOLE_LOG__(
					'cloudflare',
					'trace',
					`Cloudflare Worker Relayed HTTP fetch`,
					`Status: 200 OK (${latencyStr})`,
					{
						status: 200,
						statusText: 'OK',
						targetHost: 'ep-billowing-math.apirest.neon.tech',
						workerMemoryMb: 12.4,
						relayLatencyMs: realMs,
					}
				);
			}
		}, 300);
	};

	return (
		<div class="mt-6 space-y-6">
			{/* Use Case Tabs Selection (Clean 5-column grid with concise labels) */}
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
				{USE_CASES.map((item) => {
					const isActive = activeCaseId === item.id;
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => {
								setActiveCaseId(item.id);
								setExecutionLog(null);
							}}
							class={
								isActive
									? 'flex flex-col justify-between rounded-xl border border-indigo-500/60 bg-indigo-500/10 p-3.5 text-left transition-all shadow-sm ring-1 ring-indigo-500/30 cursor-pointer min-h-[82px]'
									: 'flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 text-left hover:border-zinc-700 hover:bg-zinc-900/80 transition-all cursor-pointer min-h-[82px]'
							}
						>
							<span
								class={
									isActive
										? 'inline-self-start rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-indigo-300 font-semibold border border-indigo-500/30'
										: 'inline-self-start rounded bg-zinc-800/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400 font-medium'
								}
							>
								{item.tag}
							</span>
							<p class="mt-2 text-xs font-bold text-white tracking-tight truncate">{item.shortTitle}</p>
						</button>
					);
				})}
			</div>

			{/* Main Showcase Panel */}
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-7 backdrop-blur-md space-y-6">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
					<div>
						<div class="flex items-center gap-2">
							<span class="h-2 w-2 rounded-full bg-emerald-400"></span>
							<h2 class="text-base sm:text-lg font-bold text-white tracking-tight">{activeCase.title}</h2>
						</div>
						<p class="mt-1 text-xs text-zinc-400 font-sans">{activeCase.subtitle}</p>
					</div>

					<button
						type="button"
						onClick={handleRunSimulation}
						disabled={isExecuting}
						class="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-white transition shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
					>
						{isExecuting ? (
							<>
								<span class="h-3 w-3 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent"></span>
								<span>Executing HTTP Fetch...</span>
							</>
						) : (
							<>
								<svg class="w-4 h-4 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
								</svg>
								<span>Run Simulation</span>
							</>
						)}
					</button>
				</div>

				<p class="text-xs sm:text-sm leading-relaxed text-zinc-300 font-sans">{activeCase.description}</p>

				{/* Code Snippet Box */}
				<div class="space-y-2">
					<span class="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Implementation Example</span>
					<div class="rounded-xl border border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-sm">
						<pre
							class="p-4 font-mono text-xs overflow-x-auto leading-relaxed text-zinc-200 w-full whitespace-pre-wrap break-words"
							dangerouslySetInnerHTML={{ __html: highlightCode(activeCase.codeSnippet, 'ts') }}
						/>
					</div>
				</div>

				{/* Request Payload & Response View Grid */}
				<div class="grid gap-4 sm:grid-cols-2 pt-1">
					{/* HTTP Payload */}
					<div class="rounded-xl border border-zinc-800/80 bg-zinc-950 overflow-hidden text-xs font-mono shadow-sm flex flex-col">
						<div class="flex items-center justify-between text-zinc-300 font-semibold bg-zinc-900/60 border-b border-zinc-800/80 px-4 py-2.5">
							<span>HTTP Request Payload</span>
							<span class="text-sky-400 font-mono text-[11px]">POST /v1/query</span>
						</div>
						<pre
							class="p-4 text-[11px] overflow-x-auto text-zinc-300 w-full whitespace-pre-wrap break-all leading-relaxed flex-1"
							dangerouslySetInnerHTML={{ __html: highlightJson(activeCase.httpPayload) }}
						/>
					</div>

					{/* HTTP Response */}
					<div class="rounded-xl border border-zinc-800/80 bg-zinc-950 overflow-hidden text-xs font-mono shadow-sm flex flex-col">
						<div class="flex items-center justify-between text-zinc-300 font-semibold bg-zinc-900/60 border-b border-zinc-800/80 px-4 py-2.5">
							<span>HTTP Response JSON</span>
							<span class="text-emerald-400 font-mono text-[11px]">{activeCase.simulatedLatency}</span>
						</div>
						<pre
							class="p-4 text-[11px] overflow-x-auto text-zinc-300 w-full whitespace-pre-wrap break-all leading-relaxed flex-1"
							dangerouslySetInnerHTML={{ __html: highlightJson(activeCase.httpResponse) }}
						/>
					</div>
				</div>

				{executionLog && (
					<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-mono text-emerald-400">
						{executionLog}
					</div>
				)}
			</div>
		</div>
	);
}
