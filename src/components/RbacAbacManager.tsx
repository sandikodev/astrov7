import { useState } from 'preact/hooks';
import type { RbacRole, AbacPolicy } from '@lib/neon';

interface Props {
	roles: RbacRole[];
	policies: AbacPolicy[];
}

export default function RbacAbacManager({ roles, policies }: Props) {
	const [activeTab, setActiveTab] = useState<'rbac' | 'abac' | 'evaluator'>('rbac');

	// Evaluator Playground State
	const [evalRole, setEvalRole] = useState<'admin' | 'developer' | 'member'>('developer');
	const [evalPermission, setEvalPermission] = useState('upload:storage');
	const [evalStorageSize, setEvalStorageSize] = useState(300);
	const [evalDept, setEvalDept] = useState('Engineering');

	// RBAC Check Logic
	const selectedRoleObj = roles.find((r) => r.name === evalRole);
	const hasRbacPermission = selectedRoleObj?.permissions.includes(evalPermission) ?? false;

	// ABAC Check Logic
	let abacPassed = true;
	let abacReason = 'All attribute policies passed.';

	if (evalRole === 'developer' && evalStorageSize > 512) {
		abacPassed = false;
		abacReason = 'ABAC Policy Violation: Developer quota limit is 512MB.';
	}

	return (
		<div class="space-y-6">
			{/* Top Tab Bar */}
			<div class="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
				<button
					type="button"
					onClick={() => setActiveTab('rbac')}
					class={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
						activeTab === 'rbac' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
					}`}
				>
					RBAC Matrix (Roles)
				</button>
				<button
					type="button"
					onClick={() => setActiveTab('abac')}
					class={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
						activeTab === 'abac' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
					}`}
				>
					ABAC Policies (Attributes)
				</button>
				<button
					type="button"
					onClick={() => setActiveTab('evaluator')}
					class={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
						activeTab === 'evaluator' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
					}`}
				>
					Live Access Evaluator
				</button>
			</div>

			{/* Tab 1: RBAC Matrix */}
			{activeTab === 'rbac' && (
				<div class="grid gap-4 sm:grid-cols-3">
					{roles.map((role) => (
						<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
							<div class="flex items-center justify-between">
								<h3 class="text-base font-bold text-white uppercase font-mono">{role.name}</h3>
								<span class="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
									{role.permissions.length} Perms
								</span>
							</div>
							<p class="text-xs text-zinc-400 leading-relaxed">{role.description}</p>
							<div class="pt-3 border-t border-zinc-800/80 space-y-1.5 font-mono text-xs">
								{role.permissions.map((perm) => (
									<div class="flex items-center gap-2 text-emerald-400">
										<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
										<span>{perm}</span>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Tab 2: ABAC Policies */}
			{activeTab === 'abac' && (
				<div class="space-y-3">
					{policies.map((pol) => (
						<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 font-mono text-xs text-zinc-300 space-y-2">
							<div class="flex items-center justify-between">
								<span class="font-bold text-white">{pol.id}</span>
								<span class="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
									Role: {pol.role}
								</span>
							</div>
							<p class="text-zinc-400 font-sans">{pol.description}</p>
							<div class="rounded bg-zinc-950 p-2.5 text-emerald-400 border border-zinc-800">
								Rule: <span class="text-white">{pol.attribute}</span> {pol.operator} <span class="text-white">{pol.value}</span>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Tab 3: Live Access Evaluator */}
			{activeTab === 'evaluator' && (
				<div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label class="block text-xs font-medium text-zinc-300 mb-1.5">User Role</label>
							<div class="relative">
								<select
									value={evalRole}
									onChange={(e) => setEvalRole((e.target as HTMLSelectElement).value as 'admin' | 'developer' | 'member')}
									class="w-full appearance-none rounded-xl border border-zinc-800/80 bg-zinc-950 px-3.5 py-2 pr-9 text-xs text-white focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer transition"
								>
									<option value="admin">Admin</option>
									<option value="developer">Developer</option>
									<option value="member">Member</option>
								</select>
								<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
									<svg class="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</div>
							</div>
						</div>

						<div>
							<label class="block text-xs font-medium text-zinc-300 mb-1.5">Target Permission</label>
							<div class="relative">
								<select
									value={evalPermission}
									onChange={(e) => setEvalPermission((e.target as HTMLSelectElement).value)}
									class="w-full appearance-none rounded-xl border border-zinc-800/80 bg-zinc-950 px-3.5 py-2 pr-9 text-xs text-white focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer transition"
								>
									<option value="upload:storage">upload:storage (Neon Object Storage)</option>
									<option value="write:data">write:data (Neon Postgres Mutations)</option>
									<option value="delete:data">delete:data (Data Purge)</option>
									<option value="manage:users">manage:users (User Administration)</option>
								</select>
								<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
									<svg class="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</div>
							</div>
						</div>

						<div>
							<label class="block text-xs font-medium text-zinc-300 mb-1.5">
								Requested Upload Size: <strong class="text-white">{evalStorageSize} MB</strong>
							</label>
							<input
								type="range"
								min="50"
								max="1024"
								step="50"
								value={evalStorageSize}
								onInput={(e) => setEvalStorageSize(Number((e.target as HTMLInputElement).value))}
								class="w-full"
							/>
						</div>

						<div>
							<label class="block text-xs font-medium text-zinc-300 mb-1.5">Department Context</label>
							<input
								type="text"
								value={evalDept}
								onInput={(e) => setEvalDept((e.target as HTMLInputElement).value)}
								class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
							/>
						</div>
					</div>

					{/* Decision Output Box */}
					<div class="rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-mono text-xs space-y-2">
						<div class="flex items-center justify-between border-b border-zinc-800 pb-2">
							<span class="text-zinc-400">Access Decision Result:</span>
							<span
								class={`font-bold px-2 py-0.5 rounded text-[11px] ${
									hasRbacPermission && abacPassed
										? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
										: 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
								}`}
							>
								{hasRbacPermission && abacPassed ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
							</span>
						</div>

						<div class="text-zinc-300">
							RBAC Check: {hasRbacPermission ? 'ALLOWED (Role has permission)' : 'DENIED (Role lacks permission)'}
						</div>
						<div class="text-zinc-300">
							ABAC Check: {abacPassed ? 'ALLOWED (Attribute policy passed)' : abacReason}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
