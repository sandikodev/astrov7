import { defineAction, ActionError } from 'astro:actions';
import type { ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import type { AstroSession } from 'astro';
import { createUserProfile, updateUserProfile, deleteUserProfile } from '@lib/neon';
import type { UserProfile } from '@lib/neon';

export interface Todo {
	id: string;
	text: string;
	done: boolean;
	createdAt: string;
}

const SESSION_KEY = 'todos';

async function readTodos(session: AstroSession): Promise<Todo[]> {
	const value = await session.get(SESSION_KEY);
	return Array.isArray(value) ? (value as Todo[]) : [];
}

// ─── Todos ────────────────────────────────────────────────────────────────────

export const addTodo = defineAction({
	input: z.object({ text: z.string().trim().min(1).max(500) }),
	handler: async ({ text }, context) => {
		if (!context.session) {
			throw new ActionError({ code: 'UNPROCESSABLE_CONTENT', message: 'Session is unavailable.' });
		}
		const todos = await readTodos(context.session);
		todos.push({ id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() });
		context.session.set(SESSION_KEY, todos);
		return todos;
	},
});

export const toggleTodo = defineAction({
	input: z.object({ id: z.string() }),
	handler: async ({ id }, context) => {
		if (!context.session) {
			throw new ActionError({ code: 'UNPROCESSABLE_CONTENT', message: 'Session is unavailable.' });
		}
		const todos = await readTodos(context.session);
		const target = todos.find((todo) => todo.id === id);
		if (!target) {
			throw new ActionError({ code: 'NOT_FOUND', message: 'Todo not found.' });
		}
		target.done = !target.done;
		context.session.set(SESSION_KEY, todos);
		return todos;
	},
});

export const removeTodo = defineAction({
	input: z.object({ id: z.string() }),
	handler: async ({ id }, context) => {
		if (!context.session) {
			throw new ActionError({ code: 'UNPROCESSABLE_CONTENT', message: 'Session is unavailable.' });
		}
		const todos = await readTodos(context.session);
		const next = todos.filter((todo) => todo.id !== id);
		context.session.set(SESSION_KEY, next);
		return next;
	},
});

// ─── User Management (admin-only RBAC guard) ───────────────────────────────

const userRoleEnum = z.enum(['admin', 'developer', 'member']);

/** Helper: read Cloudflare runtime env bypassing strict Locals type */

/** Guard: caller must have admin role (manage:users permission) */
function requireAdmin(ctx: ActionAPIContext): void {
	const user = ctx.locals?.user;
	if (!user || user.role !== 'admin') {
		throw new ActionError({ code: 'FORBIDDEN', message: 'Only admin users can manage user profiles.' });
	}
}

export const createUser = defineAction({
	input: z.object({
		id:           z.string().trim().min(1).max(100),
		email:        z.string().min(1),
		name:         z.string().trim().min(1).max(255),
		role:         userRoleEnum,
		department:   z.string().trim().min(1).max(100),
		maxStorageMb: z.number().int().min(64).max(4096),
	}),
	handler: async (input, context) => {
		requireAdmin(context);
		const created = await createUserProfile(
			// omit avatarUrl entirely so it respects exactOptionalPropertyTypes
			{ id: input.id, email: input.email, name: input.name, role: input.role, department: input.department, maxStorageMb: input.maxStorageMb }
		);
		return { success: true as const, user: created };
	},
});

export const updateUser = defineAction({
	input: z.object({
		id:           z.string().trim().min(1),
		name:         z.string().trim().min(1).max(255).optional(),
		email:        z.string().min(1).optional(),
		role:         userRoleEnum.optional(),
		department:   z.string().trim().min(1).max(100).optional(),
		maxStorageMb: z.number().int().min(64).max(4096).optional(),
	}),
	handler: async ({ id, ...raw }, context) => {
		requireAdmin(context);
		// Strip undefined values so exactOptionalPropertyTypes is respected
		const updates = Object.fromEntries(
			Object.entries(raw).filter(([, v]) => v !== undefined)
		) as Partial<Pick<UserProfile, 'name' | 'email' | 'role' | 'department' | 'maxStorageMb'>>;
		const ok = await updateUserProfile(id, updates);
		if (!ok) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update user.' });
		return { success: true as const, id };
	},
});

export const deleteUser = defineAction({
	input: z.object({
		id: z.string().trim().min(1),
	}),
	handler: async ({ id }, context) => {
		requireAdmin(context);
		const ok = await deleteUserProfile(id);
		if (!ok) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete user.' });
		return { success: true as const, id };
	},
});

export const server = {
	addTodo,
	toggleTodo,
	removeTodo,
	createUser,
	updateUser,
	deleteUser,
};