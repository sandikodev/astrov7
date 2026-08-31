import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getEnvValue } from './neon';

/**
 * Neon Object Storage S3 Client Factory
 */
export function getNeonStorageClient(envOverride?: Record<string, string>): S3Client | null {
	const endpoint = getEnvValue('AWS_ENDPOINT_URL_S3', envOverride);
	const accessKeyId = getEnvValue('AWS_ACCESS_KEY_ID', envOverride);
	const secretAccessKey = getEnvValue('AWS_SECRET_ACCESS_KEY', envOverride);
	const region = getEnvValue('AWS_REGION', envOverride) || 'us-east-2';

	if (!endpoint || !accessKeyId || !secretAccessKey) {
		return null;
	}

	return new S3Client({
		endpoint,
		region,
		credentials: {
			accessKeyId,
			secretAccessKey,
		},
		forcePathStyle: true, // Required for custom S3 endpoints
	});
}

/**
 * Upload Avatar to Neon Object Storage bucket "assets"
 */
export async function uploadAvatar(
	userId: string,
	fileBuffer: Buffer | Uint8Array,
	contentType: string = 'image/png',
	envOverride?: Record<string, string>
): Promise<{ success: boolean; url: string; key: string }> {
	const client = getNeonStorageClient(envOverride);
	const bucketName = getEnvValue('S3_BUCKET_NAME', envOverride) || 'assets';
	const key = `avatars/${userId}-${Date.now()}.png`;

	if (!client) {
		// Mock fallback preview URL for demonstration if S3 keys not present
		const mockUrl = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;
		return { success: true, url: mockUrl, key };
	}

	try {
		const command = new PutObjectCommand({
			Bucket: bucketName,
			Key: key,
			Body: fileBuffer,
			ContentType: contentType,
			ACL: 'public-read',
		});

		await client.send(command);

		const endpoint = getEnvValue('AWS_ENDPOINT_URL_S3', envOverride);
		const publicUrl = `${endpoint}/${bucketName}/${key}`;
		return { success: true, url: publicUrl, key };
	} catch (err) {
		console.error('Neon Object Storage upload error:', err);
		// Fallback preview URL
		return {
			success: false,
			url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
			key,
		};
	}
}
