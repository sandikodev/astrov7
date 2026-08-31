import { astro, FetchState } from 'astro/fetch';

export default {
	async fetch(request: Request, _env: Env, _ctx: ExecutionContext) {
		const state = new FetchState(request);
		return astro(state);
	},
} satisfies ExportedHandler<Env>;