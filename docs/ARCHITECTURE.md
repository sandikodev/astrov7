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

The app never silently corrupts; every failure path is visible and typed.

---

## 11. Neon Serverless Ecosystem Architecture

This codebase integrates the complete **Neon Serverless Ecosystem** running over Cloudflare Workers:

### 11.1 Neon Data API (`src/lib/neon.ts`)
Instead of initializing heavyweight TCP poolers on short-lived Workers, dynamic routes query Neon via **stateless HTTP/2 REST requests** (`/v1/query`). This ensures zero connection overhead, instant cold-starts, and Row-Level Security (RLS) enforcement via Bearer Tokens.

### 11.2 Neon Auth & JWKS (`src/pages/auth/index.astro`)
User authentication is managed via Neon Auth (BetterAuth adapter). Authentication tokens are validated against Neon's published JWKS JSON endpoint (`NEON_AUTH_JWKS_URL`), maintaining stateless JWT session verification without database roundtrips.

### 11.3 Neon Object Storage (`src/lib/storage.ts`)
Avatar uploads connect directly to Neon's S3-compatible Object Storage endpoint (`AWS_ENDPOINT_URL_S3`) using `@aws-sdk/client-s3`. Presigned upload URLs and multipart stream handlers keep file storage decoupled from the main database.

### 11.4 RBAC & ABAC Governance Matrix (`src/middleware.ts`)
Astro middleware intercepts requests to `/app/*` and evaluates user role (RBAC) and dynamic resource attributes (ABAC) before allowing route rendering.

---

## 12. Dev Trace Console & Universal SSE Real-time Telemetry

A key architectural feature of this application is the universal **Dev Trace Console** (`DevTraceConsole.tsx`):

- **Sticky Viewport Docking**: Rendered as a `sticky bottom-0 z-50` bar across all pages.
- **Cross-Tab SSE Synchronization**: Server-side events emitted to `/api/dev-telemetry/emit` are broadcast via Server-Sent Events (`/api/dev-telemetry/stream`) to all open browser windows in real time.
- **3-Tab Live Trace**:
  - 🌐 **Client & App Events**: SPA navigation, page transitions, and UI actions.
  - 🐘 **Neon Serverless Trace**: REST query execution timings, SQL statements, and RLS headers.
  - ⛅ **Cloudflare Edge Trace**: Edge Colo location (`CGK`), CF-Ray IDs, and SSR execution milliseconds.

---

## 13. Edge Runtime Caveats & Engine Panics (GitHub Issue #17868)

During local development with `astro dev` and `@astrojs/cloudflare`, developers may encounter a specific runtime crash. We submitted a comprehensive report to `withastro/astro`:

> 🐛 **GitHub Issue #17868**: `[bug] @astrojs/cloudflare dev runner panics workerd on SSR module resolution failure, breaking route registry`

### 13.1 Failure Mechanism (3-Step Domino Effect)

1. **Unresolved Virtual Specifiers in `workerd`**:
   During `astro dev`, `@astrojs/cloudflare` spawns a local `workerd` C++ subprocess. When Vite SSR passes unresolved dynamic aliases or virtual script queries (such as `<ClientRouter />`'s `ClientRouter.astro?astro&type=script`) into the V8 isolate, the C++ runtime throws an uncaught exception (`remote.jsg.Error: Unable to resolve ...`).
2. **IPC Pipe Disconnection (`Broken Pipe`)**:
   Because `@astrojs/cloudflare` does not catch this exception at the IPC socket boundary, `workerd` panics and abruptly closes the Unix socket pipe:
   `kj/async-io-unix.c++:186: disconnected: ::write(fd, buffer.begin(), buffer.size()): Broken pipe`
3. **Route Registry Collapse**:
   Astro's `DevFacadeApp` (`getModuleForRoute` in `astro/dist/core/environment/production.js`) loses socket connection to `workerd`, clearing its route component map and causing subsequent requests to fail with:
   `Error: Unexpectedly unable to find a component instance for route /`

### 13.2 Verified Production Workarounds

Our codebase implements the official triaged mitigations to ensure 100% stability:

1. **`ssr.optimizeDeps.noDiscovery = true`**: Prevents Vite 6 mid-flight dependency discovery from wiping `.vite/deps_ssr`.
2. **Explicit Dependency Exclusion**: Excluding `@astrojs/preact`, `astro/actions`, `astro:actions`, and `astro/content` in `astro.config.mjs` under `vite.optimizeDeps.exclude` and `vite.ssr.optimizeDeps.exclude`.
3. **Path Aliasing**: Single Source of Truth aliasing via `tsconfig.json` (`@components/*`, `@layouts/*`, `@lib/*`, etc.).
### 13.3 Environment Resolution (`cloudflare:workers`)
Astro v6+ removes access to `Astro.locals.runtime.env` in the Cloudflare adapter to enforce environment purity. In this reference implementation, all environment variables (`DATABASE_URL`, `AWS_ACCESS_KEY_ID`, etc.) are resolved centrally in `src/lib/neon.ts` and `src/lib/storage.ts` using the Cloudflare virtual module:
```ts
import { env } from 'cloudflare:workers';
const cfEnv = env as unknown as Record<string, string>;
```
This isolates the dependency and eliminates the need to recursively pass `env` through middleware and actions.

---

## 14. Operational Pitfalls

### 14.1 The Silent Mock Fallback
If you deploy the application without setting `DATABASE_URL` via Cloudflare Secrets (`wrangler secret put DATABASE_URL`), **the app will not throw a 500 on boot**. Instead, `src/lib/neon.ts` handles the missing connection gracefully by falling back to `MOCK_PROFILES` (an in-memory array of user data).

However, in a deployed Serverless architecture, Cloudflare V8 isolates are ephemeral and distributed. The in-memory array is destroyed constantly.
**Symptoms**:
- Users get caught in infinite login/logout loops.
- `GET /app/users` continuously redirects to login (HTTP 302).
- Edits made on the client vanish immediately.
**Resolution**: Bind your database secrets so the application uses the durable Neon PostgreSQL layer instead of the ephemeral mock layer.
