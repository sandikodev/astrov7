import { neon } from '@neondatabase/serverless';

export interface UserProfile {
	id: string;
	email: string;
	name: string;
	avatarUrl?: string;
	role: 'admin' | 'developer' | 'member';
	department: string;
	maxStorageMb: number;
	createdAt: string;
}

export interface RbacRole {
	name: string;
	description: string;
	permissions: string[];
}

export interface AbacPolicy {
	id: string;
	role: string;
	attribute: string;
	operator: 'equals' | 'less_than_or_equal' | 'in';
	value: string;
	description: string;
}

// Helper to safely read env variables without triggering Astro v6+ runtime.env getter error
export function getEnvValue(key: string, envOverride?: Record<string, string>): string | undefined {
	if (envOverride && envOverride[key]) return envOverride[key];
	if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
	try {
		return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key];
	} catch {
		return undefined;
	}
}

// Fallback mock data when DB credentials are pending initial provision
const MOCK_PROFILES: UserProfile[] = [
	{
		id: 'usr_dev_01',
		email: 'dev@astrov7.community',
		name: 'Astro Developer',
		avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
		role: 'admin',
		department: 'Engineering',
		maxStorageMb: 1024,
		createdAt: '2026-08-31T10:00:00.000Z',
	},
	{
		id: 'usr_dev_02',
		email: 'community@astrov7.io',
		name: 'Community Member',
		role: 'developer',
		department: 'Open Source',
		maxStorageMb: 256,
		createdAt: '2026-08-31T10:15:00.000Z',
	},
];

const DEFAULT_RBAC_ROLES: RbacRole[] = [
	{
		name: 'admin',
		description: 'Full administrative access to all webapp resources and Neon DB features.',
		permissions: ['read:data', 'write:data', 'delete:data', 'manage:users', 'upload:storage'],
	},
	{
		name: 'developer',
		description: 'Developer access to execute API endpoints, manage session KV, and upload assets.',
		permissions: ['read:data', 'write:data', 'upload:storage'],
	},
	{
		name: 'member',
		description: 'Standard community user access with read-only data & personal profile management.',
		permissions: ['read:data'],
	},
];

const DEFAULT_ABAC_POLICIES: AbacPolicy[] = [
	{
		id: 'pol_storage_cap',
		role: 'developer',
		attribute: 'maxStorageMb',
		operator: 'less_than_or_equal',
		value: '512',
		description: 'Developers cannot upload files exceeding their 512MB quota.',
	},
	{
		id: 'pol_dept_access',
		role: 'admin',
		attribute: 'department',
		operator: 'in',
		value: 'Engineering, Security, Core',
		description: 'Admin actions restricted to core operational departments.',
	},
];

/**
 * Get Neon Serverless SQL Client
 */
export function getNeonSql(envOverride?: Record<string, string>) {
	const dbUrl = getEnvValue('DATABASE_URL', envOverride);
	if (!dbUrl) {
		return null;
	}
	return neon(dbUrl);
}

let tablesInitialized = false;

/**
 * Ensure database tables exist in Neon Postgres
 */
export async function ensureNeonTables(envOverride?: Record<string, string>) {
	if (tablesInitialized) return true;
	const sql = getNeonSql(envOverride);
	if (!sql) return false;

	try {
		await sql`
			CREATE TABLE IF NOT EXISTS user_profiles (
				id VARCHAR(100) PRIMARY KEY,
				email VARCHAR(255) UNIQUE NOT NULL,
				name VARCHAR(255) NOT NULL,
				avatar_url TEXT,
				role VARCHAR(50) DEFAULT 'member',
				department VARCHAR(100) DEFAULT 'General',
				max_storage_mb INT DEFAULT 256,
				created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
			);
		`;
		tablesInitialized = true;
		return true;
	} catch (e) {
		console.warn('Neon DB table setup warning:', e);
		return false;
	}
}

/**
 * Fetch Profiles from Neon DB or Fallback
 */
export async function getUserProfiles(envOverride?: Record<string, string>): Promise<UserProfile[]> {
	const sql = getNeonSql(envOverride);
	if (sql) {
		try {
			await ensureNeonTables(envOverride);
			const rows = await sql`SELECT * FROM user_profiles ORDER BY created_at DESC;`;
			if (rows.length > 0) {
				return rows.map((r: any) => ({
					id: r.id,
					email: r.email,
					name: r.name,
					avatarUrl: r.avatar_url,
					role: r.role,
					department: r.department,
					maxStorageMb: r.max_storage_mb,
					createdAt: new Date(r.created_at).toISOString(),
				}));
			}
		} catch (e) {
			console.warn('Neon query error, using fallback:', e);
		}
	}
	return MOCK_PROFILES;
}

/**
 * Update Profile Avatar URL in Neon DB without clobbering existing profile names
 */
export async function updateUserAvatar(userId: string, avatarUrl: string, envOverride?: Record<string, string>): Promise<boolean> {
	const sql = getNeonSql(envOverride);
	if (sql) {
		try {
			await ensureNeonTables(envOverride);
			await sql`
				INSERT INTO user_profiles (id, email, name, avatar_url, role, department)
				VALUES (${userId}, ${userId + '@astrov7.io'}, 'Astro Developer', ${avatarUrl}, 'developer', 'Engineering')
				ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url;
			`;
			return true;
		} catch (e) {
			console.error('Failed to update user avatar in Neon DB:', e);
		}
	}
	// Update mock in-memory
	const target = MOCK_PROFILES.find((p) => p.id === userId);
	if (target) target.avatarUrl = avatarUrl;
	return true;
}

export function getRbacRoles(): RbacRole[] {
	return DEFAULT_RBAC_ROLES;
}

export function getAbacPolicies(): AbacPolicy[] {
	return DEFAULT_ABAC_POLICIES;
}
