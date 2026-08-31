import { useState } from 'preact/hooks';

interface Props {
	redirectUrl?: string;
}

export default function AuthForm({ redirectUrl = '/app' }: Props) {
	const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
	const [email, setEmail] = useState('dev@astrov7.community');
	const [password, setPassword] = useState('password123');
	const [name, setName] = useState('Astro Developer');
	const [role, setRole] = useState<'admin' | 'developer' | 'member'>('admin');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setLoading(true);
		setMessage(null);

		try {
			const res = await fetch('/api/auth/signin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, name, role }),
			});
			const data: any = await res.json();

			if (data.success) {
				setMessage(`Successfully ${activeTab === 'signin' ? 'signed in' : 'registered'}! Redirecting...`);
				setTimeout(() => {
					window.location.href = redirectUrl;
				}, 400);
			} else {
				setMessage(`Error: ${data.error}`);
			}
		} catch (err: any) {
			setMessage(`Authentication error: ${err.message}`);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class="w-full rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-6 sm:p-7 backdrop-blur-2xl shadow-2xl shadow-black/80">
			{/* Segmented Floating Tab Controller */}
			<div class="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-950/80 p-1 border border-zinc-800/80 mb-6">
				<button
					type="button"
					onClick={() => setActiveTab('signin')}
					class={`rounded-xl py-2 text-xs font-semibold tracking-tight transition-all duration-200 ${
						activeTab === 'signin'
							? 'bg-zinc-800 text-white shadow-md border border-zinc-700/50'
							: 'text-zinc-400 hover:text-zinc-200'
					}`}
				>
					Sign In
				</button>
				<button
					type="button"
					onClick={() => setActiveTab('signup')}
					class={`rounded-xl py-2 text-xs font-semibold tracking-tight transition-all duration-200 ${
						activeTab === 'signup'
							? 'bg-zinc-800 text-white shadow-md border border-zinc-700/50'
							: 'text-zinc-400 hover:text-zinc-200'
					}`}
				>
					Create Account
				</button>
			</div>

			{message && (
				<div class="mb-5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-300 font-mono text-center">
					{message}
				</div>
			)}

			<form onSubmit={handleSubmit} class="space-y-4 text-left">
				{activeTab === 'signup' && (
					<div>
						<label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono mb-1.5">
							Full Name
						</label>
						<input
							type="text"
							value={name}
							onInput={(e) => setName((e.target as HTMLInputElement).value)}
							placeholder="e.g. Astro Developer"
							required
							class="w-full h-10 rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3.5 text-xs text-white placeholder-zinc-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
						/>
					</div>
				)}

				<div>
					<label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono mb-1.5">
						Email Address
					</label>
					<input
						type="email"
						value={email}
						onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
						placeholder="dev@astrov7.community"
						required
						class="w-full h-10 rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3.5 text-xs text-white placeholder-zinc-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
					/>
				</div>

				<div>
					<label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono mb-1.5">
						Password
					</label>
					<input
						type="password"
						value={password}
						onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
						placeholder="••••••••••••"
						required
						class="w-full h-10 rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3.5 text-xs text-white placeholder-zinc-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
					/>
				</div>

				{activeTab === 'signup' && (
					<div>
						<label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono mb-1.5">
							Community Role
						</label>
						<div class="relative">
							<select
								value={role}
								onChange={(e) => setRole((e.target as HTMLSelectElement).value as 'admin' | 'developer' | 'member')}
								class="w-full h-10 appearance-none rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3.5 pr-9 text-xs text-white focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all cursor-pointer"
							>
								<option value="admin">Admin (Full RBAC/ABAC)</option>
								<option value="developer">Developer (Default)</option>
								<option value="member">Community Member</option>
							</select>
							<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
								<svg class="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</div>
						</div>
					</div>
				)}

				<button
					type="submit"
					disabled={loading}
					class="w-full mt-3 flex h-11 items-center justify-center rounded-xl bg-white font-bold text-xs text-zinc-950 hover:bg-zinc-200 active:scale-[0.99] transition shadow-lg shadow-white/10 disabled:opacity-50"
				>
					{loading ? (
						<span class="flex items-center gap-2">
							<svg class="animate-spin h-3.5 w-3.5 text-zinc-950" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
							</svg>
							Authenticating...
						</span>
					) : activeTab === 'signin' ? (
						'Sign In to Webapp →'
					) : (
						'Register Account →'
					)}
				</button>

				<div class="pt-4 border-t border-zinc-800/60 text-center">
					<span class="text-[11px] text-zinc-500 font-mono">
						Powered by <strong class="text-zinc-300">Neon Auth (Managed Better Auth)</strong>
					</span>
				</div>
			</form>
		</div>
	);
}
