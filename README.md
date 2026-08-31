# astrov7 — Astro v7 × Cloudflare Workers (reference implementation)

> A single Astro codebase that is **two things at once**: a fully-static *website* and an
> on-demand *webapp*, deployed together on **Cloudflare Workers with Workers Static Assets**.
> Built to serve as a community reference for production-grade Astro v7 patterns on Cloudflare's free tier.

**Live demo** → https://astrov7.sandikodev.workers.dev

![Astro v7](https://img.shields.io/badge/Astro-7.2-FF5D01?logo=astro&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TS-strictest-3178C6?logo=typescript&logoColor=white)
![Preact](https://img.shields.io/badge/Preact-islands-673AB8?logo=preact&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Free tier](https://img.shields.io/badge/deploy-FREE-00C853)

---

## Table of contents

- [Why this project exists](#why-this-project-exists)
- [What it demonstrates](#what-it-demonstrates)
- [Architecture in one picture](#architecture-in-one-picture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Cloudflare-specifics](#cloudflare-specifics)
- [Deployment](#deployment)
- [The data-fetch hierarchy](#the-data-fetch-hierarchy)
- [Docs](#docs)
- [Roadmap / slots for your own experiments](#roadmap--slots-for-your-own-experiments)

---

## Why this project exists

Astro v7 (the "speed release", Rust compiler, Sätteri Markdown, queued rendering) lands on
**Cloudflare Workers** as the default deploy target — the `@astrojs/cloudflare` adapter **no longer
supports Cloudflare Pages**. This repo is a working, deployed proof that the modern stack works:

- **Static island rendering** for the public site (zero server cost, edge-cached files).
- **On-demand rendering** for the app half, all inside **one Worker** that Cloudflare auto-provisions
  bindings for (`ASSETS`, encrypted `SESSION` KV, `IMAGES`).
- Everything runs on the **Cloudflare free plan** — this demo is live without paying a cent.

---

## What it demonstrates

| Route | Rendering | Pattern highlighted |
|-------|-----------|---------------------|
| `/` | static (build-time) | Landing page, zero fetch, served as a file |
| `/blog` · `/blog/[slug]` | static (build-time) | Content collections, typed frontmatter, `getCollection`, `getStaticPaths` |
| `/404` | static | Custom 404 via Workers Assets `not_found_handling: "404-page"` |
| `/` redirects | static | `_redirects` (301 from legacy path) |
| `/app` | on-demand | App shell; sidebar + mobile tab bar; live streamed timestamps |
| `/app/weather` | on-demand | Server-side upstream `fetch` + **page-level route caching** + **server island** (`server:defer`) |
| `/app/todos` | on-demand | **`astro:actions`** mutations + **Sessions** (encrypted KV) per browser |
| `/app/search` | on-demand | Preact **client island** → **route-cached API** + **tag invalidation** |
| `/api/weather` | on-demand | Typed `fetchJsonWithTimeout`, `cache.set({maxAge, swr, tags})` |
| `/api/search` | on-demand | Route-cached JSON endpoint (SWR), debounced by the client island |
| `/api/revalidate` | on-demand | Purging the Cloudflare edge cache by tag via `context.cache.invalidate` |

Every app route is `export const prerender = false` (on-demand) while the rest of the repo stays
`output: 'static'` by default — **hybrid rendering inside a single deployment**.

---

## Architecture in one picture

```text
                         ┌────────────────────────────────────────────┐
   Browser ─────────────►│  Cloudflare Workers (static assets + SSR)  │
                         │                                            │
                         │  /  /blog/*   → dist/client  ·  (files)    │
                         │  /app/*       → Worker SSR   ·  (cached)   │
                         │  /api/*       → Worker SSR   ·  (SWR)      │
                         │                                            │
                         │   bindings: ASSETS · SESSION (KV) · IMAGES │
                         └──────┬──────────────┬──────────────┬───────┘
                                │              │              │
                     upstream    ▼              ▼              ▼
                   (fetch w/   Weather API   Encrypted    Image
                    timeout)    · public     session KV   transforms
                                JSONPlaceholder
                                    · public
```

- **Static half** (`/`, `/blog/*`): produced at `astro build`, uploaded as assets, served by
  Cloudflare's global CDN. Requests to static assets are **free & unlimited**.
- **Dynamic half** (`/app/*`, `/api/*`): `prerender = false` pages run on the Worker on every
  request, streamed HTML, cached via `Astro.cache` / `routeRules` SWR.
- **State**: encrypted, per-browser sessions persisted in Workers KV.
- **Cache invalidation**: `/api/revalidate` purges cached routes globally by tag.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Astro 7.2** | `prerender = false` per route, server islands, actions, sessions, route caching |
| Runtime | **Cloudflare Workers** (`@astrojs/cloudflare` 14) | Pages support was removed; Workers + Assets is the official path |
| Islands | **Preact** (via `@astrojs/preact`) | `client:load` for Todos & Search; `server:defer` server island |
| Styling | **Tailwind CSS 4** (`@tailwindcss/vite`) | Utility-first, dark app shell |
| Types | **TypeScript `strictest`** preset + `astro check` gating builds | `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, etc. |
| Validation | **`astro/zod`** (Zod 4) | Typed action inputs, typed content collections |
| Deploy | **Wrangler** (`wrangler deploy`) | Generates `dist/server/wrangler.json` with auto-provisioned bindings |

---

## Project structure

```text
astrov7/
├── public/                    # copied verbatim into dist/client
│   ├── favicon.svg · favicon.ico
│   └── _redirects             # 301 rewrite rules (Workers Assets)
├── src/
│   ├── actions/index.ts       # astro:actions: addTodo/toggleTodo/removeTodo
│   ├── components/
│   │   ├── AppNav.astro       # webapp sidebar + mobile tab bar
│   │   ├── CacheInfo.astro    # displays the emitted CDN cache policy
│   │   ├── LiveStats.astro    # server island (server:defer)
│   │   ├── Nav.astro          # public site navigation
│   │   ├── PatternNote.astro  # inline "lesson" cards
│   │   ├── SearchBox.tsx      # Preact island (client:load)
│   │   ├── TodoApp.tsx        # Preact island (client:load)
│   │   └── Welcome.astro
│   ├── content.config.ts      # blog collection schema (astro/zod)
│   ├── content/blog/*.md      # 3 static posts (Content Layer API)
│   ├── fetch.ts               # Worker entrypoint via astro/fetch + FetchState
│   ├── layouts/               # Layout.astro (site) · AppLayout.astro (app shell)
│   ├── lib/http.ts            # fetchJsonWithTimeout (AbortController + typed errors)
│   ├── pages/
│   │   ├── index.astro · 404.astro
│   │   ├── app/index.astro · weather.astro · todos.astro · search.astro
│   │   ├── api/weather.ts · search.ts · revalidate.ts
│   │   └── blog/index.astro · blog/[slug].astro
│   └── styles/global.css
├── astro.config.mjs           # adapter, sessions, cache provider, routeRules
├── wrangler.jsonc             # Worker config: assets, compatibility, observability
├── tsconfig.json              # astro/tsconfigs/strictest + astro ts-plugin
├── .env.example               # env var conventions (astro:env)
└── worker-configuration.d.ts  # generated by `wrangler types`
```

---

## Getting started

Requires **Node ≥ 22.12** (Astro 7) and a Cloudflare account (free).

```sh
# 1. install (repo is set up for Bun, but works with any package manager)
bun install

# 2. start the dev server against local workerd bindings
bun run dev          # → localhost:4321 (generates worker-configuration.d.ts first)

# 3. type-check + build
bun run build        # astro check && astro build → dist/

# 4. deploy to Cloudflare Workers (or run `cf:build` to skip deploy)
bun run cf:deploy    # wrangler types && astro check && astro build && wrangler deploy
```

| Script | Action |
|--------|--------|
| `bun run dev` | `wrangler types && astro dev` |
| `bun run check` | `astro check` (0 warnings/0 errors goal) |
| `bun run build` | `astro check && astro build` |
| `bun run preview` | `astro preview` |
| `bun run cf:build` | `wrangler types && astro check && astro build` |
| `bun run cf:deploy` | full build + `wrangler deploy --config dist/server/wrangler.json` |
| `bun run cf:preview` | `wrangler types && astro preview` (workerd runtime) |

---

## Cloudflare-specifics

### `wrangler.jsonc`

```jsonc
{
  "name": "astrov7",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "2026-08-30",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "not_found_handling": "404-page"
  },
  "observability": { "enabled": true }
}
```

Notable pieces:

- **`assets.not_found_handling: "404-page"`** — serves `dist/client/404.html` on unknown paths
  (required for custom 404 on Worker Assets; default returns a bare 404).
- **`nodejs_compat`** — lets you use Node-flavored APIs on the Worker.
- **Auto-provisioned bindings** — the adapter injects `SESSION` KV + `IMAGES` at build/deploy;
  you see them in `dist/server/wrangler.json`.

### `astro.config.mjs`

```js
export default defineConfig({
  output: 'static', // ← default; on-demand pages opt in individually
  env: { schema: {} }, // astro:env (type-safe env, add envField entries as needed)
  session: { ttl: 60 * 60 * 24 * 7, cookie: 'astrov7-session' }, // encrypted KV sessions
  cache: { provider: cacheCloudflare() }, // Cloudflare worker cache provider
  routeRules: { '/api/search': { swr: 60 } }, // CDN-level SWR for the search endpoint
  integrations: [preact()],
  adapter: cloudflare({ imageService: { build: 'compile', runtime: 'cloudflare-binding' } }),
});
```

### `src/fetch.ts` — advanced routing

The adapter supports Astro 7's advanced routing: this `src/fetch.ts` becomes the Worker entrypoint,
yet you still write ordinary pages/endpoints above it.

```ts
import { astro, FetchState } from 'astro/fetch';

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext) {
    const state = new FetchState(request);
    return astro(state);
  },
} satisfies ExportedHandler<Env>;
```

### Environment & secrets

- `.env` for `astro dev` local vars; `.dev.vars` (git-ignored) for `wrangler dev` secrets.
- Production secrets: `wrangler secret put <KEY>` → read via `astro:env/server` once added to
  `env.schema`. `PUBLIC_*` vars are inlined for the client. See `.env.example`.

---

## Deployment

```sh
# one-command deploy (types → check → build → deploy)
bun run cf:deploy

# or step by step
wrangler login                                  # authenticate as your Cloudflare account
bun run cf:build
wrangler deploy --config dist/server/wrangler.json
```

- Deploys **7 files** (JS entry + assets) to your `*.workers.dev` domain.
- **CI/CD**: hook up [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
  with build command `bun run cf:build` and deploy command `wrangler deploy --config dist/server/wrangler.json`.

> ⚠️ Free-tier note for SSG-heavy Rust-compiled builds: keep an eye on the free **10 ms CPU per
> invocation** — the static half never touches the Worker, but a complex SSR page can use several ms.

---

## The data-fetch hierarchy

This repo is also a graded walk-through of "how much server work should a route do?":

1. **Build-time (SSG)** — `/`, `/blog/*`: nothing runs at request time.
2. **Content collections** — typed Markdown, generated once during build.
3. **On-demand page + upstream fetch** — `/app/weather`: `await fetch()` in frontmatter, streamed.
4. **Page-level route caching** — `Astro.cache.set({ maxAge, swr, tags })` → served from the edge.
5. **Client island → cached API** — `/app/search` + `/api/search`: debounce + AbortController.
6. **`astro:actions` mutations** — server-validated by Zod, returns fresh state.
7. **Sessions in KV** — encrypted, cookie-bound per-user storage.
8. **Cache invalidation** — `/api/revalidate` purges tags globally.

Each is explained inline on its page via `<PatternNote>` cards.

---

## Docs

| File | Contents |
|------|----------|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Rendering model, data-fetch hierarchy, caching, sessions, images, env & TS deep dive |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Authenticating, deploy commands, CI/CD, secrets, custom domains, troubleshooting |

---

## Roadmap / slots for your own experiments

Everything below fits the same stack and is intentionally left open:

- **D1** database-backed CRUD (rows-read friendly on the free plan, `import { env } from 'cloudflare:workers'`).
- **R2** user uploads (10 GB free, free egress).
- **Durable Objects** (SQLite-backed) for realtime/WebSocket state.
- **Workers AI + Vectorize** for RAG / semantic search.
- **Turnstile** captcha on the action forms.

---

> Built as a reference for the community. PRs/issues welcome — the goal is to keep this repo a
> living example of Astro v7 + Cloudflare best practices on the free tier.