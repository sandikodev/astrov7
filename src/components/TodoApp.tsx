import { useState } from 'preact/hooks';
import { actions } from 'astro:actions';
import type { Todo } from '@/actions';

interface ActionErrorLike {
	message?: string;
	issues?: Array<{ message?: string }>;
}

interface Props {
	initial?: Todo[];
}

function formatError(error: unknown): string {
	if (!error) return 'Something went wrong.';
	if (typeof error === 'string') return error;
	const e = error as ActionErrorLike;
	if (e.message) return e.message;
	if (e.issues?.length) return e.issues.map((issue) => issue.message).join('; ');
	return JSON.stringify(error);
}

export default function TodoApp({ initial = [] }: Props) {
	const [todos, setTodos] = useState<Todo[]>(initial);
	const [text, setText] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function run(task: () => Promise<{ data?: unknown; error?: unknown }>) {
		setBusy(true);
		setError(null);
		try {
			const result = await task();
			if (result.error) {
				setError(formatError(result.error));
			} else {
				setTodos((result.data as Todo[]) ?? []);
			}
		} catch (err) {
			setError(formatError(err));
		} finally {
			setBusy(false);
		}
	}

	function onSubmit(event: Event) {
		event.preventDefault();
		const value = text.trim();
		if (!value || busy) return;
		setText('');
		void run(() => actions.addTodo({ text: value }));
	}

	function onToggle(todo: Todo) {
		if (busy) return;
		void run(() => actions.toggleTodo({ id: todo.id }));
	}

	function onRemove(todo: Todo) {
		if (busy) return;
		void run(() => actions.removeTodo({ id: todo.id }));
	}

	return (
		<div class="space-y-4">
			<form onSubmit={onSubmit} class="flex flex-col sm:flex-row gap-2.5">
				<input
					type="text"
					value={text}
					onInput={(event) => setText((event.target as HTMLInputElement).value)}
					placeholder="Add a new task…"
					maxLength={500}
					class="flex-1 rounded-lg border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition min-h-[40px]"
				/>
				<button
					type="submit"
					disabled={busy || text.trim().length === 0}
					class="rounded-lg bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] shadow-sm cursor-pointer"
				>
					{busy ? 'Saving…' : 'Add Task'}
				</button>
			</form>

			{error && (
				<p class="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
					{error}
				</p>
			)}

			<ul class="space-y-2">
				{todos.length === 0 && (
					<li class="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
						No tasks yet — items added here save to your encrypted Cloudflare KV session.
					</li>
				)}
				{todos.map((todo) => (
					<li
						key={todo.id}
						class="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 transition hover:border-zinc-700"
					>
						<button
							type="button"
							onClick={() => onToggle(todo)}
							aria-label={todo.done ? 'Mark active' : 'Mark done'}
							class={
								todo.done
									? 'flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-800 text-xs font-bold text-white'
									: 'flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 text-transparent hover:border-zinc-500 transition'
							}
						>
							✓
						</button>
						<span class={todo.done ? 'flex-1 text-xs sm:text-sm text-zinc-500 line-through' : 'flex-1 text-xs sm:text-sm text-zinc-200 font-medium'}>
							{todo.text}
						</span>
						<button
							type="button"
							onClick={() => onRemove(todo)}
							aria-label={`Delete ${todo.text}`}
							class="rounded px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition"
						>
							Delete
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}