import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import type { AstroSession } from 'astro';

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

export const server = { addTodo, toggleTodo, removeTodo };