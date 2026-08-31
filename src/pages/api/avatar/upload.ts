export const prerender = false;
import type { APIRoute } from 'astro';
import { uploadAvatar } from '@lib/storage';
import { updateUserAvatar } from '@lib/neon';
import { broadcastServerTelemetry } from '@lib/telemetry';

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		// Session Guard
		const sessionToken = cookies.get('astrov7-session')?.value || cookies.get('astro_v7_session')?.value;
		if (!sessionToken) {
			return new Response(JSON.stringify({ error: 'Unauthorized: Valid session required for avatar uploads' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const formData = await request.formData();
		const file = formData.get('avatar') as File | null;
		const userId = (formData.get('userId') as string) || 'usr_dev_01';

		if (!file) {
			return new Response(JSON.stringify({ error: 'No avatar image file provided' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Server-side file validation (Max 5MB, image MIME types only)
		const MAX_SIZE = 5 * 1024 * 1024;
		const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

		if (file.size > MAX_SIZE) {
			return new Response(JSON.stringify({ error: 'File size exceeds maximum 5MB limit' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
			return new Response(JSON.stringify({ error: `Invalid image type '${file.type}'. Allowed: PNG, JPEG, WEBP, GIF` }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = new Uint8Array(arrayBuffer);

		// Upload to Neon Object Storage
		const uploadRes = await uploadAvatar(userId, buffer, file.type);

		// Update database profile
		await updateUserAvatar(userId, uploadRes.url);

		// Broadcast real-time SSE telemetry log across all connected browser clients!
		broadcastServerTelemetry({
			tab: 'neon',
			level: 'success',
			title: 'Neon Object Storage Avatar Uploaded',
			summary: `Key: ${uploadRes.key} (${Math.round(file.size / 1024)} KB)`,
			detail: {
				userId,
				objectKey: uploadRes.key,
				storageUrl: uploadRes.url,
				fileSizeKb: Math.round(file.size / 1024),
				mimeType: file.type,
				dbSyncStatus: 'User profile avatar URL updated in Neon Postgres DB',
				timestamp: new Date().toISOString(),
			},
		});

		return new Response(
			JSON.stringify({
				success: true,
				url: uploadRes.url,
				key: uploadRes.key,
				message: 'Avatar uploaded to Neon Object Storage & saved in Neon Postgres DB!',
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || 'Avatar upload failed' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
