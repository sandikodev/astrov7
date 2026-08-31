import { useState } from 'preact/hooks';
import type { UserProfile } from '@lib/neon';

interface Props {
	initialProfile: UserProfile;
}

export default function ProfileEditor({ initialProfile }: Props) {
	const [profile, setProfile] = useState<UserProfile>(initialProfile);
	const [uploading, setUploading] = useState(false);
	const [statusMsg, setStatusMsg] = useState<string | null>(null);

	const handleFileChange = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;

		const file = target.files[0];
		if (!file) return;

		setUploading(true);
		setStatusMsg(null);

		const formData = new FormData();
		formData.append('avatar', file);
		formData.append('userId', profile.id);

		try {
			const res = await fetch('/api/avatar/upload', {
				method: 'POST',
				body: formData,
			});
			const data: any = await res.json();

			if (data.success) {
				setProfile((prev) => ({ ...prev, avatarUrl: data.url }));
				setStatusMsg('Avatar uploaded to Neon Object Storage & saved to Neon DB!');
			} else {
				setStatusMsg(`Upload failed: ${data.error}`);
			}
		} catch (err: any) {
			setStatusMsg(`Upload error: ${err.message}`);
		} finally {
			setUploading(false);
		}
	};

	return (
		<div class="space-y-6">
			{/* Status Banner */}
			{statusMsg && (
				<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-mono text-emerald-400">
					{statusMsg}
				</div>
			)}

			{/* Main Profile Card */}
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-md">
				<div class="flex flex-col sm:flex-row items-center gap-6">
					{/* Avatar Image Uploader */}
					<div class="relative group">
						<div class="h-24 w-24 overflow-hidden rounded-2xl border-2 border-zinc-700 bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-xl font-bold">
							{profile.avatarUrl ? (
								<img src={profile.avatarUrl} alt={profile.name} class="h-full w-full object-cover" />
							) : (
								profile.name.charAt(0)
							)}
						</div>
						<label
							aria-label="Upload new avatar"
							class="absolute inset-0 flex items-center justify-center rounded-2xl bg-zinc-950/80 opacity-0 group-hover:opacity-100 transition cursor-pointer text-xs font-semibold text-white"
						>
							{uploading ? 'Uploading...' : 'Change'}
							<input
								type="file"
								accept="image/*"
								onChange={handleFileChange}
								disabled={uploading}
								class="hidden"
							/>
						</label>
					</div>

					{/* Profile Details */}
					<div class="flex-1 text-center sm:text-left min-w-0">
						<div class="flex items-center justify-center sm:justify-start gap-2">
							<h2 class="text-xl font-bold text-white truncate">{profile.name}</h2>
							<span class="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-300">
								{profile.role}
							</span>
						</div>
						<p class="mt-1 text-xs text-zinc-400 font-mono truncate">{profile.email}</p>

						<div class="mt-4 flex flex-wrap justify-center sm:justify-start gap-3 text-xs font-mono text-zinc-400">
							<span class="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1">
								Dept: <strong class="text-zinc-200">{profile.department}</strong>
							</span>
							<span class="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1">
								Quota: <strong class="text-zinc-200">{profile.maxStorageMb} MB</strong>
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Neon & Cloudflare Integration Spec Cards Grid */}
			<div class="grid gap-4 sm:grid-cols-2">
				{/* Neon Status */}
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-xs font-mono text-zinc-400 space-y-3">
					<div class="flex items-center justify-between text-zinc-200 font-semibold border-b border-zinc-800 pb-2">
						<span>Neon Integration Status</span>
						<span class="flex items-center gap-1.5 text-emerald-400">
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
							Active
						</span>
					</div>
					<div class="space-y-2">
						<div class="flex justify-between">
							<span class="text-zinc-500">Database Engine:</span>
							<span class="text-zinc-300 font-semibold">Neon Postgres</span>
						</div>
						<div class="flex justify-between">
							<span class="text-zinc-500">Object Storage:</span>
							<span class="text-zinc-300 font-semibold">Neon S3 Bucket</span>
						</div>
						<div class="flex justify-between">
							<span class="text-zinc-500">Auth Engine:</span>
							<span class="text-zinc-300 font-semibold">Neon Auth</span>
						</div>
					</div>
				</div>

				{/* Cloudflare Status */}
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-xs font-mono text-zinc-400 space-y-3">
					<div class="flex items-center justify-between text-zinc-200 font-semibold border-b border-zinc-800 pb-2">
						<span>Cloudflare Integration Status</span>
						<span class="flex items-center gap-1.5 text-emerald-400">
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
							Active
						</span>
					</div>
					<div class="space-y-2">
						<div class="flex justify-between">
							<span class="text-zinc-500">Adapter:</span>
							<span class="text-zinc-300 font-semibold">@astrojs/cloudflare</span>
						</div>
						<div class="flex justify-between">
							<span class="text-zinc-500">Image Binding:</span>
							<span class="text-zinc-300 font-semibold">Cloudflare Images</span>
						</div>
						<div class="flex justify-between">
							<span class="text-zinc-500">Session Driver:</span>
							<span class="text-zinc-300 font-semibold">Cloudflare KV</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
