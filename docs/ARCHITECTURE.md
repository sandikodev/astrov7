# Architecture — astrov7 (Astro v7 × Cloudflare Workers)

Deep dive into how this repo is built. It is meant to be read top-to-bottom as a mental model
before poking at the code.

---

## 1. The core idea: one repo, two rendering strategies

Astro 7 keeps a **static-by-default** output mode while letting individual routes opt into
**on-demand rendering** in a single deployment. That combination is exactly what Cloudflare
Workers + Static Assets ships as the build artifact:

- `output: 'static'` in `astro.config.mjs` is the default.
- Every app route starts with `export const prerender = false`.
- `@astrojs/cloudflare` compiles the project into an **entry Worker** (`dist/server/entry.mjs`)
  plus a **static asset folder** (`dist/client/`), wired together by `dist/server/wrangler.json`.

### The render-time ladder

| # | Strategy | Where | Request-time cost |
|---|----------|-------|-------------------|
| 1 | Build-time static | `/`, `/blog/*`, `/404` | **0 ms — served as files** |
| 2 | On-demand page | `/app/*` | Worker runs, HTML streamed |
| 3 | On-demand endpoint | `/api/*` | Worker runs, JSON streamed |

This is the same hosting topology as a classic "Jamstack + serverless functions" site, except the
whole thing is **one Worker** and Cloudflare provisions the `ASSETS`, `SESSION`, and `IMAGES`
bindings automatically.

---

## 2. Request lifecycle of an app route

Take `/app/weather`:

```text
GET /app/weather
  → Worker fetches entry (src/fetch.ts → astro(fetchState))
  → Astro frontmatter runs:
       const result = await fetchJsonWithTimeout(url)   // 8s AbortController timeout
       Astro.cache.set({ maxAge: 600, swr: 1800, tags: ['weather'] })
  → HTML streams to the browser (queued rendering)
  → <LiveStats server:defer> renders AGAIN on a second, cached request (server island)
```

### Why `fetchJsonWithTimeout` (`src/lib/http.ts`)

A raw `fetch` in frontmatter can hang forever on a bad upstream and burn your CPU budget. The
wrapper adds:

- an **AbortController** with a default 8 s deadline;
- a normalized result: `{ ok: true, data }` **or** `{ ok: false, error }`;
- explicit handling of `AbortError`.

The downstream components/pages branch on `result.ok`, so failures are surfaced as pixels
(an error card) rather than silent corrupt data or 500s.

---

## 3. Route caching (Cloudflare)

Two layers cooperate:

### 3.1 `routeRules` (config level)

```js
routeRules: {
  '/api/search': { swr: 60 }, // CDN serves cached JSON; revalidate at most once per 60s
}
```

### 3.2 `Astro.cache.set` (per request, in code)

```ts
context.cache.set({ maxAge: 600, swr: 1800, tags: ['weather'] });
```

- `maxAge` — how long Cloudflare serves the cached copy without revalidation.
- `swr` — after `maxAge`, the edge may serve stale while revalidating in the background.
- `tags` — a handle for **global invalidation**.

### 3.3 Invalidation

`/api/revalidate` (POST `{ "tags": [...] }`) calls `context.cache.invalidate({ tags })` and purges
the matching entries from Cloudflare's global cache — useful after content changes or upstream data
refreshes.

> The `cacheCloudflare()` provider in `astro.config.mjs` is what enables the `Astro.cache` API on
> this runtime. See `CHANGELOG` notes shipped with `@astrojs/cloudflare` for the exact semantics.

---

## 4. Sessions in Workers KV

`/app/todos` stores a per-browser task list:

```ts
export default defineConfig({
  session: { ttl: 60 * 60 * 24 * 7, cookie: 'astrov7-session' },
  adapter: cloudflare({ ... }),
});
```

- The adapter auto-provisions a **`SESSION` KV namespace** (no manual setup).
- Values are **signed + encrypted** and tied to a cookie; nothing secret is shipped to the client.
- Server reads: `const todos = await Astro.session?.get('todos');` (see `todos.astro`).
- Mutations are never done client-side — the Preact island calls `astro:actions` functions.

### Why actions (not ad-hoc POST endpoints)?

`astro:actions` gives you a typed RPC boundary:

1. Define with `defineAction({ input: z.object(...), handler })` — input is **validated by Zod**.
2. Call from the island: `actions.addTodo({ text })` — types flow end-to-end.
3. Server errors become typed `ActionError`s instead of string soup.

---

## 5. Islands

Two kinds:

- **Client islands** (`client:load`): `TodoApp.tsx`, `SearchBox.tsx`. Preact hydrated only where
  interactivity exists. `SearchBox` debounces (300 ms) and aborts in-flight requests on each
  keystroke.
- **Server island** (`server:defer`): `LiveStats.astro` — renders after the main HTML, on a second
  request, then streams in. Great for anything slow/optional on the page.

---

## 6. Images

`imageService: { build: 'compile', runtime: 'cloudflare-binding' }`:

- `build: 'compile'` — statically prerendered images are optimized at **build time**, so the
  static content ships zero runtime cost.
- `runtime: 'cloudflare-binding'` — dynamic/on-demand images go through the **Cloudflare Images
  binding** (`IMAGES`), transformed at the edge.

The **Images free plan** includes the `IMAGES` binding + 5,000 unique transformations/month.

---

## 7. Advanced routing via `src/fetch.ts`

The adapter exposes the raw Worker entry. Because we use `astro/fetch` + `FetchState`, we get a
custom entrypoint (future custom fetch logic / `ExecutionContext` / `env` access) without losing
any Astro page/endpoint ergonomics:

```ts
import { astro, FetchState } from 'astro/fetch';
export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext) {
    return astro(new FetchState(request));
  },
} satisfies ExportedHandler<Env>;
```

Bindings arrive typed because `wrangler types` generates `worker-configuration.d.ts` (`Env`), kept
in sync via the `dev` / `cf:*` scripts.

---

## 8. TypeScript "strictest" setup

`tsconfig.json` extends `astro/tsconfigs/strictest` and adds the Astro TS plugin. That enables:
`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`,
`noImplicitReturns`, `verbatimModuleSyntax`, `jsxImportSource: 'preact'`, and typed
`.astro` files via the plugin.

```jsonc
{
  "extends": "astro/tsconfigs/strictest",
  "plugins": [{ "name": "@astrojs/ts-plugin" }],
}
```

Because `astro check` runs in `build`, `cf:build`, and `cf:deploy`, the bar is enforced in CI too.

---

## 9. Environment handling

- Schema lives in `astro.config.mjs` → `env.schema` and is (deliberately) empty — add `envField`
  entries as real vars appear, then import them from `astro:env/server` / `astro:env/client`.
- `.env.example` documents conventions:
  - unprefixed → server-side only;
  - `PUBLIC_*` → inlined, available on the client;
  - `.dev.vars` → local `wrangler dev` secrets (git-ignored).

---

## 10. Failure handling philosophy

- **Upstream timeout**: `fetchJsonWithTimeout` → rendered error card, `Cache-Control: no-store`.
- **Session missing**: `ActionError` `UNPROCESSABLE_CONTENT`.
- **Todo missing**: `ActionError` `NOT_FOUND`.
- **Cache disabled**: `/api/revalidate` returns 400 with an explanation.

The app never silently corrupts; every failure path is visible and typed.