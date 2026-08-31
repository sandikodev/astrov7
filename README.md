# astrov7 — Astro v7 × Cloudflare Workers × Neon Serverless (Reference Implementation)

> A single Astro codebase that is **two things at once**: a fully-static *website* and an on-demand *webapp*, deployed together on **Cloudflare Workers with Workers Static Assets** and powered by **Neon Serverless Postgres, Neon Auth, & Neon Object Storage**.
> Built to serve as an international community reference for production-grade Astro v7 patterns, edge computing, and serverless database integration.

**Live demo** → [https://astrov7.sandikodev.workers.dev](https://astrov7.sandikodev.workers.dev)

[![Astro v7](https://img.shields.io/badge/Astro-7.2-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Neon Postgres](https://img.shields.io/badge/Neon-Serverless_Postgres-00E599?logo=postgresql&logoColor=white)](https://neon.tech)
[![TypeScript](https://img.shields.io/badge/TS-strictest-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Preact](https://img.shields.io/badge/Preact-islands-673AB8?logo=preact&logoColor=white)](https://preactjs.com)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Free Tier Friendly](https://img.shields.io/badge/deploy-FREE-00C853)](https://workers.cloudflare.com)

---

## Table of Contents

- [Why This Project Exists](#why-this-project-exists)
- [What It Demonstrates](#what-it-demonstrates)
- [Architecture in One Picture](#architecture-in-one-picture)
- [Deep Dive: Neon Serverless Ecosystem Integration](#deep-dive-neon-serverless-ecosystem-integration)
- [Real-Time Telemetry: Dev Trace Console (SSE)](#real-time-telemetry-dev-trace-console-sse)
- [Known Caveat & Engine Issue (GitHub Issue #17868)](#known-caveat--engine-issue-github-issue-17868)
- [Clean Architecture & Import Aliasing Convention](#clean-architecture--import-aliasing-convention)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Cloudflare & Environment Configuration](#cloudflare--environment-configuration)
- [Deployment](#deployment)
- [The Data-Fetch Hierarchy](#the-data-fetch-hierarchy)
- [Docs](#docs)
- [Roadmap & Integration Slots (Sanity, Sentry, Payload CMS)](#roadmap--integration-slots-sanity-sentry-payload-cms)

---

## Why This Project Exists

Astro v7 (the "speed release", Rust compiler, Sätteri Markdown, queued rendering) lands on **Cloudflare Workers** as the default deploy target — the `@astrojs/cloudflare` adapter **no longer supports Cloudflare Pages**. This repository is a working, deployed proof that the modern edge stack works seamlessly:

- **Static island rendering** for the public site (zero server cost, edge-cached files).
- **On-demand rendering** for the app half, all inside **one Worker** that Cloudflare auto-provisions bindings for (`ASSETS`, encrypted `SESSION` KV, `IMAGES`).
- **Serverless Database & Auth**: Direct HTTP/2 querying via Neon Data API, JWT authentication via Neon Auth (BetterAuth-compatible), and S3-compatible avatar uploads via Neon Object Storage.
- **Universal Dev Console**: Real-time Server-Sent Events (SSE) telemetry synced live across all open browser instances.
- **Free Tier Friendly**: Everything runs on the Cloudflare and Neon free tiers — live without paying a cent.

---

## What It Demonstrates

| Route | Rendering | Pattern Highlighted |
|---|---|---|
| `/` | Static (build-time) | Landing page, zero fetch, served as edge assets |
| `/blog` · `/blog/[slug]` | Static (build-time) | Content collections, typed frontmatter, `getCollection`, `getStaticPaths` |
| `/404` | Static | Custom 404 via Workers Assets `not_found_handling: "404-page"` |
| `/` redirects | Static | `_redirects` (301 rewrite rules from legacy paths) |
| `/auth` | On-demand | Prestige tabbed Sign In / Register SPA modal powered by Neon Auth |
| `/app` | On-demand | App shell; full-width sticky banner header + micro-footer |
| `/app/overview` | On-demand | Real-time Worker streaming dashboard |
| `/app/neon-api` | On-demand | Serverless HTTP Postgres querying via **Neon Data API** (`/v1/query`) |
| `/app/weather` | On-demand | Server-side upstream `fetch` + **page-level route caching** + **server island** (`server:defer`) |
| `/app/todos` | On-demand | **`astro:actions`** mutations + **Sessions** (encrypted Cloudflare KV) per browser |
| `/app/search` | On-demand | Preact **client island** → **route-cached API** + **tag invalidation** |
| `/app/profile` | On-demand | Profile management + avatar uploads to **Neon Object Storage (S3)** |
| `/app/settings` | On-demand | **RBAC & ABAC Governance Matrix** simulator |
| `/api/weather` | On-demand | Typed `fetchJsonWithTimeout`, `cache.set({maxAge, swr, tags})` |
| `/api/search` | On-demand | Route-cached JSON endpoint (SWR), debounced by Preact island |
| `/api/revalidate` | On-demand | Purging the Cloudflare edge cache by tag via `context.cache.invalidate` |
| `/api/avatar/upload` | On-demand | S3 Presigned Multipart Upload to Neon Object Storage |
| `/api/dev-telemetry/stream` | On-demand | Real-time Server-Sent Events (SSE) log stream for DevTraceConsole |
| `/api/dev-telemetry/emit` | On-demand | Multi-browser broadcast endpoint for real-time telemetry sync |

---

## Architecture in One Picture

```text
                               ┌───────────────────────────────────────────────────────────┐
     Browser (User) ──────────►│        Cloudflare Workers Edge (Hybrid SSR + Assets)       │
                               │                                                           │
                               │  /  /blog/*      → Static Assets (CDN Cache - 0ms Cost)   │
                               │  /app/*          → Worker SSR (On-Demand HTML Streaming) │
                               │  /api/*          → Worker SSR (SWR Route-Cached JSON)     │
                               │                                                           │
                               │   bindings: ASSETS  ·  SESSION (KV)  ·  IMAGES            │
                               └───────┬──────────────────┬──────────────────┬─────────────┘
                                       │                  │                  │
                             Neon API  ▼        Neon Auth ▼       Neon S3    ▼
                           ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
                           │ Neon Data API │  │   Neon Auth   │  │ Neon Storage  │
                           │  REST / HTTP2 │  │  JWKS / OAuth │  │ S3 Compatible │
                           └───────────────┘  └───────────────┘  └───────────────┘
```

- **Static Half** (`/`, `/blog/*`): Produced at `astro build`, uploaded as static assets, served by Cloudflare's global CDN with zero Worker invocations.
- **Dynamic Half** (`/app/*`, `/api/*`): `prerender = false` pages run on the Worker on every request, streaming HTML and JSON cached via `Astro.cache` / `routeRules` SWR.
- **Database & Storage Layer**: Neon Serverless Postgres pooler, HTTP Data API, BetterAuth JWT validation, and S3 Bucket integration.
- **State**: Encrypted, per-browser sessions persisted in Cloudflare Workers KV (`SESSION`).
- **Telemetry**: Cross-browser log synchronization via Server-Sent Events (SSE).

---

## Deep Dive: Neon Serverless Ecosystem Integration

This codebase serves as an end-to-end integration sample for the **Neon Serverless Ecosystem** on Cloudflare Workers:

### 1. Neon Data API (`src/lib/neon.ts`)
Instead of opening heavy TCP database connections, the application communicates with Neon using stateless **HTTP/2 REST queries** (`/v1/query`). This eliminates connection pooling overhead on Cloudflare Workers and enforces Row-Level Security (RLS) via Bearer Tokens.

### 2. Neon Auth & JWKS (`src/pages/auth/index.astro`)
Authentication is handled via Neon Auth (BetterAuth compatible). The server validates incoming session tokens against Neon's published JWKS endpoint (`NEON_AUTH_JWKS_URL`), storing signed cookies locally while maintaining serverless auth state.

### 3. Neon Object Storage (`src/lib/storage.ts` & `src/pages/api/avatar/upload.ts`)
Avatar image uploads utilize `@aws-sdk/client-s3` connected to Neon's S3-compatible Object Storage endpoint (`AWS_ENDPOINT_URL_S3`). Uploads are processed with presigned URLs or direct Worker multipart streams.

### 4. Governance Matrix (RBAC & ABAC)
Integrated Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) policies evaluate incoming user permissions dynamically inside Astro middleware (`src/middleware.ts`).

---

## Real-Time Telemetry: Dev Trace Console (SSE)

A key highlight of this repository is the universal **Dev Trace Console** (`DevTraceConsole.tsx`):

- **Sticky Viewport Docking**: Positioned as `sticky bottom-0 z-50`, staying accessible at the bottom of the screen across both the public website and the webapp shell.
- **Multi-Browser SSE Sync**: Log events generated in one browser tab are broadcast via `/api/dev-telemetry/emit` and streamed via Server-Sent Events (`/api/dev-telemetry/stream`) to all connected browser windows in real time.
- **3-Tab Live Inspection**:
  - 🌐 **Client & App Events**: SPA navigation, ClientRouter transitions, user actions.
  - 🐘 **Neon Serverless Trace**: HTTP REST query payloads, execution timings, RLS status.
  - ⛅ **Cloudflare Edge Trace**: Edge Colo location (e.g. `CGK - Jakarta`), CF-Ray IDs, SSR execution milliseconds.
- **Resizable Console Drawer**: Draggable top border to adjust height dynamically from 160px to 650px.

---

## Known Caveat & Engine Issue (GitHub Issue #17868)

During local development with `astro dev` and `@astrojs/cloudflare`, developers may encounter a specific runtime crash. We submitted a comprehensive report to `withastro/astro`:

> 🐛 **GitHub Issue #17868**: `[bug] @astrojs/cloudflare dev runner panics workerd on SSR module resolution failure, breaking route registry`

### Failure Mechanism (3-Step Domino Effect)

1. **Unresolved Virtual Specifiers in `workerd`**:
   During `astro dev`, `@astrojs/cloudflare` spawns a local `workerd` C++ subprocess. When Vite SSR passes unresolved dynamic aliases or virtual script queries (such as `<ClientRouter />`'s `ClientRouter.astro?astro&type=script`) into the V8 isolate, the C++ runtime throws an uncaught exception (`remote.jsg.Error: Unable to resolve ...`).
2. **IPC Pipe Disconnection (`Broken Pipe`)**:
   Because `@astrojs/cloudflare` does not catch this exception at the IPC socket boundary, `workerd` panics and abruptly closes the Unix socket pipe:
   `kj/async-io-unix.c++:186: disconnected: ::write(fd, buffer.begin(), buffer.size()): Broken pipe`
3. **Route Registry Collapse**:
   Astro's `DevFacadeApp` (`getModuleForRoute` in `astro/dist/core/environment/production.js`) loses socket connection to `workerd`, clearing its route component map and causing subsequent requests to fail with:
   `Error: Unexpectedly unable to find a component instance for route /`

### Verified Production Workarounds

To stabilize `astro dev` completely, our codebase implements the official triaged mitigations:

1. **`ssr.optimizeDeps.noDiscovery = true`**: Prevents Vite 6 mid-flight dependency discovery from wiping `.vite/deps_ssr`.
2. **Explicit Dependency Exclusion**: Excluding `@astrojs/preact`, `astro/actions`, `astro:actions`, and `astro/content` in `astro.config.mjs` under `vite.optimizeDeps.exclude` and `vite.ssr.optimizeDeps.exclude`.
3. **Path Aliasing**: Resolving imports via `tsconfig.json` paths or relative imports for SSR routes.

---

## Clean Architecture & Import Aliasing Convention

Following official Astro community best practices, path aliases are configured with a **Single Source of Truth** in `tsconfig.json`. Astro automatically inherits these paths into Vite without needing duplicate declarations in `astro.config.mjs`:

```json
{
  "extends": "astro/tsconfigs/strictest",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@lib/*": ["src/lib/*"],
      "@content/*": ["src/content/*"],
      "@styles/*": ["src/styles/*"],
      "@pages/*": ["src/pages/*"]
    }
  }
}
```

### Layout Composition Architecture
- **`BaseLayout.astro`**: Universal root shell (`<head>`, `<ClientRouter />`, CSS, `<DevTraceConsole />`).
- **`Layout.astro`**: Public marketing & blog layout (composes `BaseLayout`).
- **`AppLayout.astro`**: Webapp desktop app shell + native mobile UX (composes `BaseLayout`).
- **`AuthLayout.astro`**: Full-screen ambient auth layout (composes `BaseLayout`).

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 7.2** | `prerender = false` per route, server islands, actions, sessions, route caching |
| Runtime | **Cloudflare Workers** (`@astrojs/cloudflare` 14) | Workers + Static Assets official target |
| Database | **Neon Serverless Postgres** | HTTP/2 REST Data API, pooler connection, RLS security |
| Auth | **Neon Auth (BetterAuth)** | JWT validation, JWKS endpoint, tabbed SPA auth modal |
| Object Storage | **Neon Storage (S3)** | `@aws-sdk/client-s3` avatar image upload streams |
| Islands | **Preact** (`@astrojs/preact`) | Interactivity (`TodoApp`, `SearchBox`, `DevTraceConsole`) |
| Styling | **Tailwind CSS 4** (`@tailwindcss/vite`) | Utility-first styling with Vite integration |
| Telemetry | **Server-Sent Events (SSE)** | Real-time cross-browser console log stream |
| Types | **TypeScript `strictest`** | Gated builds via `astro check` |

---

## Project Structure

```text
astrov7/
├── docs/
│   ├── ARCHITECTURE.md          # Architectural deep-dive & rendering ladder
│   └── DEPLOYMENT.md            # Cloudflare Workers deploy guide & troubleshooting
├── src/
│   ├── actions/index.ts         # astro:actions: addTodo/toggleTodo/removeTodo
│   ├── components/
│   │   ├── AppNav.astro         # Webapp sidebar + mobile navigation
│   │   ├── AuthForm.tsx         # Preact tabbed sign in / registration form
│   │   ├── CacheInfo.astro      # CDN cache headers display
│   │   ├── DevTraceConsole.tsx  # Universal sticky SSE telemetry console
│   │   ├── LiveStats.astro      # Server island (server:defer)
│   │   ├── Nav.astro            # Public website navigation
│   │   ├── NeonDataApiShowcase.tsx # Live HTTP REST query runner
│   │   ├── PatternNote.astro    # Architectural pattern cards
│   │   ├── ProfileEditor.tsx    # User profile & avatar editor
│   │   ├── RbacAbacManager.tsx  # Governance matrix manager
│   │   ├── SearchBox.tsx        # Debounced Preact search island
│   │   └── TodoApp.tsx          # KV-persisted task list island
│   ├── content/blog/*.md        # Static Markdown blog posts
│   ├── layouts/
│   │   ├── BaseLayout.astro     # Universal root shell layout
│   │   ├── Layout.astro         # Public website layout
│   │   ├── AppLayout.astro      # Webapp workspace layout
│   │   └── AuthLayout.astro     # Ambient auth page layout
│   ├── lib/
│   │   ├── http.ts              # AbortController fetch wrapper
│   │   ├── neon.ts              # Neon Data API & Auth helpers
│   │   ├── storage.ts           # S3 Object Storage client
│   │   ├── syntaxHighlight.ts   # Prism syntax highlighter
│   │   └── telemetry.ts         # SSE event emitter & client registry
│   ├── pages/
│   │   ├── index.astro · 404.astro
│   │   ├── auth/index.astro     # Neon Auth SPA route
│   │   ├── app/                 # overview, weather, todos, search, profile, settings, neon-api
│   │   ├── api/                 # weather, search, revalidate, auth, dev-telemetry, avatar
│   │   └── blog/                # index, [slug]
│   ├── middleware.ts            # RBAC/ABAC middleware & session guard
│   └── styles/global.css        # Tailwind 4 theme
├── astro.config.mjs             # Adapter, sessions, cache provider, routeRules
├── wrangler.jsonc               # Worker bindings (ASSETS, SESSION KV, IMAGES, vars)
├── tsconfig.json                # Single Source of Truth path aliases
├── .env.example                 # Environment variables reference
└── worker-configuration.d.ts    # Generated Wrangler type declarations
```

---

## Getting Started

Requires **Node ≥ 22.12** (Astro 7) and a Cloudflare account (free tier).

```sh
# 1. Install dependencies
bun install

# 2. Start dev server (generates worker-configuration.d.ts & boots astro dev)
bun run dev          # → http://localhost:4321

# 3. Type-check (0 errors, 0 warnings requirement)
bun run check        # astro check

# 4. Production Build
bun run build        # astro check && astro build → dist/

# 5. Deploy to Cloudflare Workers
bun run cf:deploy    # wrangler types && astro check && astro build && wrangler deploy
```

---

## Cloudflare & Environment Configuration

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
  "kv_namespaces": [
    {
      "binding": "SESSION",
      "id": "astrov7_dev_session_kv"
    }
  ],
  "vars": {
    "PUBLIC_NEON_DATA_API_URL": "https://ep-sample.apirest.us-east-2.aws.neon.tech/neondb/rest/v1",
    "PUBLIC_NEON_AUTH_URL": "https://ep-sample.neonauth.us-east-2.aws.neon.tech/neondb/auth"
  }
}
```

### Environment Resolution (`cloudflare:workers`)
Astro v6 restricts direct access to `Astro.locals.runtime.env` for environment variables. In this codebase, all environment resolutions (including Cloudflare Secrets like `DATABASE_URL`) are handled centrally in `src/lib/neon.ts` using the Cloudflare virtual module:

```ts
import { env } from 'cloudflare:workers';
const cfEnvSafe = env as unknown as Record<string, string>;
export function getEnvValue(key: string) { return cfEnvSafe[key] || process.env[key]; }
```

### Secrets
To run the database in production, you must set Cloudflare Secrets (do not add them to `wrangler.jsonc`):
```sh
wrangler secret put DATABASE_URL
wrangler secret put AWS_ACCESS_KEY_ID
wrangler secret put AWS_SECRET_ACCESS_KEY
```

---

## Deployment

Deploying to Cloudflare Workers is handled via a single command:

```sh
bun run cf:deploy
```

This executes the full automated pipeline:
1. `wrangler types` — generates `worker-configuration.d.ts` for typed bindings.
2. `astro check` — verifies 100% type safety across all Astro, Preact, and TS files.
3. `astro build` — compiles static assets to `dist/client` and Worker entrypoints to `dist/server`.
4. `wrangler deploy` — publishes the bundle to Cloudflare's global edge network.

---

## Roadmap & Integration Slots (Sanity, Sentry, Payload CMS)

This repository is designed to evolve into an international multi-CMS and observability benchmark for Astro v7 edge deployments:

- [ ] **Sanity.io Integration (Primary Headless CMS Benchmark)**: Structured headless CMS content fetching with GROQ queries, live visual preview, and edge caching.
- [ ] **Payload CMS (Optional Headless CMS Alternative)**: Serverless Node/Postgres headless CMS integration alternative backed by Neon Postgres.
- [ ] **Sentry Edge Observability**: Automated edge error tracking, trace context propagation, and performance monitoring for Cloudflare Workers.
- [ ] **Turnstile Captcha**: Cloudflare Turnstile integration on authentication and action forms.
- [ ] **Workers AI & Vectorize**: Edge RAG embeddings & semantic search integration.

---

> Built as an open reference for the global developer community. Pull requests and issues are welcome — our goal is to maintain this repository as a living benchmark for Astro v7, Cloudflare Workers, and Neon Serverless architecture.