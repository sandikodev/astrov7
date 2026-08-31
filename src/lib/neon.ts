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

import { env as cfEnv } from 'cloudflare:workers';

// Helper to safely read env variables across local dev and Cloudflare Workers
export function getEnvValue(key: string): string | undefined {
	// Check Cloudflare virtual module (production & wrangler dev)
	const cfEnvSafe = cfEnv as unknown as Record<string, string>;
	if (cfEnvSafe && cfEnvSafe[key]) return cfEnvSafe[key];

	// Check process.env (Node environments / fallback)
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
export function getNeonSql() {
	const dbUrl = getEnvValue('DATABASE_URL');
	if (!dbUrl) {
		return null;
	}
	return neon(dbUrl);
}

let tablesInitialized = false;

/**
 * Ensure database tables exist in Neon Postgres
 */
export async function ensureNeonTables() {
	if (tablesInitialized) return true;
	const sql = getNeonSql();
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
export async function getUserProfiles(): Promise<UserProfile[]> {
	const sql = getNeonSql();
	if (sql) {
		try {
			await ensureNeonTables();
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
 * Fetch a single user by ID
 */
export async function getUserProfile(id: string): Promise<UserProfile | null> {
	const sql = getNeonSql();
	if (sql) {
		try {
			await ensureNeonTables();
			const rows = await sql`SELECT * FROM user_profiles WHERE id = ${id};`;
			if (rows.length > 0) {
				const r = rows[0]!;
				return {
					id: r.id, email: r.email, name: r.name, avatarUrl: r.avatar_url,
					role: r.role, department: r.department, maxStorageMb: r.max_storage_mb,
					createdAt: new Date(r.created_at).toISOString(),
				};
			}
			return null;
		} catch (e) {
			console.warn('Neon query error in getUserProfile:', e);
		}
	}
	return MOCK_PROFILES.find((p) => p.id === id) || null;
}

/**
 * Fetch a single user by Email
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
	const sql = getNeonSql();
	if (sql) {
		try {
			await ensureNeonTables();
			const rows = await sql`SELECT * FROM user_profiles WHERE email = ${email};`;
			if (rows.length > 0) {
				const r = rows[0]!;
				return {
					id: r.id, email: r.email, name: r.name, avatarUrl: r.avatar_url,
					role: r.role, department: r.department, maxStorageMb: r.max_storage_mb,
					createdAt: new Date(r.created_at).toISOString(),
				};
			}
			return null;
		} catch (e) {
			console.warn('Neon query error in getUserProfileByEmail:', e);
		}
	}
	return MOCK_PROFILES.find((p) => p.email === email) || null;
}

/**
 * Update Profile Avatar URL in Neon DB without clobbering existing profile names
 */
export async function updateUserAvatar(userId: string, avatarUrl: string): Promise<boolean> {
	const sql = getNeonSql();
	if (sql) {
		try {
			await ensureNeonTables();
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

/**
 * Create a new user profile in Neon DB (or fallback mock)
 */
export async function createUserProfile(
	user: Omit<UserProfile, 'createdAt'>
): Promise<UserProfile> {
	const newUser: UserProfile = { ...user, createdAt: new Date().toISOString() };
	const sql = getNeonSql();
	if (sql) {
		try {
			await ensureNeonTables();
			await sql`
				INSERT INTO user_profiles (id, email, name, avatar_url, role, department, max_storage_mb)
				VALUES (
					${newUser.id}, ${newUser.email}, ${newUser.name},
					${newUser.avatarUrl ?? null}, ${newUser.role},
					${newUser.department}, ${newUser.maxStorageMb}
				)
				ON CONFLICT (id) DO UPDATE SET
					name             = EXCLUDED.name,
					email            = EXCLUDED.email,
					role             = EXCLUDED.role,
					department       = EXCLUDED.department,
					max_storage_mb   = EXCLUDED.max_storage_mb;
			`;
		} catch (e) {
			console.error('createUserProfile error:', e);
		}
	}
	const existingIdx = MOCK_PROFILES.findIndex((p) => p.id === newUser.id);
	if (existingIdx >= 0) MOCK_PROFILES[existingIdx] = newUser;
	else MOCK_PROFILES.unshift(newUser);
	return newUser;
}

/**
 * Update an existing user profile in Neon DB (or fallback mock)
 */
export async function updateUserProfile(
	id: string,
	updates: Partial<Pick<UserProfile, 'name' | 'email' | 'role' | 'department' | 'maxStorageMb'>>
): Promise<boolean> {
	if (Object.keys(updates).length === 0) return true;

	const sql = getNeonSql();
	if (sql) {
		try {
			await ensureNeonTables();
			
			// COALESCE to update only provided fields without dynamic query builder (which Neon HTTP doesn't support via sql tag)
			await sql`
				UPDATE user_profiles 
				SET 
					name = COALESCE(${updates.name !== undefined ? updates.name : null}, name),
					email = COALESCE(${updates.email !== undefined ? updates.email : null}, email),
					role = COALESCE(${updates.role !== undefined ? updates.role : null}, role),
					department = COALESCE(${updates.department !== undefined ? updates.department : null}, department),
					max_storage_mb = COALESCE(${updates.maxStorageMb !== undefined ? updates.maxStorageMb : null}, max_storage_mb)
				WHERE id = ${id}
			`;
		} catch (e) {
			console.error('updateUserProfile error:', e);
			return false;
		}
	}
	const target = MOCK_PROFILES.find((p) => p.id === id);
	if (target) Object.assign(target, updates);
	return true;
}

/**
 * Delete a user profile from Neon DB (or fallback mock)
 */
export async function deleteUserProfile(
	id: string
): Promise<boolean> {
	const sql = getNeonSql();
	if (sql) {
		try {
			await ensureNeonTables();
			await sql`DELETE FROM user_profiles WHERE id = ${id}`;
		} catch (e) {
			console.error('deleteUserProfile error:', e);
			return false;
		}
	}
	const idx = MOCK_PROFILES.findIndex((p) => p.id === id);
	if (idx >= 0) MOCK_PROFILES.splice(idx, 1);
	return true;
}
