---
title: Neon Serverless Postgres & REST Data API on Cloudflare Workers
description: How to run stateless HTTP/2 REST database queries, JWT JWKS authentication, and S3 Object Storage on edge workers without TCP connection pooling overhead.
pubDate: 2026-08-31
tags: ['neon', 'postgres', 'cloudflare', 'edge-database', 'serverless']
---

Integrating relational databases into edge runtimes like Cloudflare Workers has historically faced a major bottleneck: **TCP connection overhead**. Establishing a new TLS and PostgreSQL connection on every short-lived worker invocation drains CPU budgets and causes cold-start latency.

The **Neon Serverless Ecosystem** solves this by providing three complementary edge-native integration strategies:

### 1. Stateless HTTP/2 REST Data API (`/v1/query`)

Instead of opening a TCP socket connection pooler, the worker sends an HTTP/2 POST request containing parametrized SQL queries to Neon's REST endpoint:

```ts
const response = await fetch(`${PUBLIC_NEON_DATA_API_URL}/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ query: 'SELECT * FROM users WHERE role = $1', params: ['admin'] })
});
```

Benefits for Cloudflare Workers:
- **Zero Connection Overhead**: No TCP state held in memory across invocations.
- **Sub-10ms Cold Starts**: Instant request execution at the edge.
- **Row-Level Security (RLS)**: Enforced dynamically using user Bearer Tokens.

### 2. Neon Auth & JWKS Token Verification

Authentication state is verified statelessly at the edge using Neon Auth (BetterAuth compatible). The worker fetches published JSON Web Key Sets (JWKS) from `NEON_AUTH_JWKS_URL` and validates user JWT tokens inside Astro middleware without making a single database call:

```ts
const jwks = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));
const { payload } = await jwtVerify(token, jwks);
```

### 3. S3-Compatible Object Storage

User file assets (such as profile avatars) are stored in Neon's S3-compatible Object Storage. The worker generates presigned upload URLs using `@aws-sdk/client-s3`, keeping binary file storage decoupled from relational database tables.

This architecture powers the `/app/neon-api`, `/app/profile`, and `/app/settings` pages in this application.

### 4. Centralized Edge Secrets & Configuration

When deploying Astro v6/v7 on Cloudflare Workers, access to `Astro.locals.runtime.env` has been removed to enforce environment purity. We address this by centralizing all Cloudflare bindings (like `DATABASE_URL`) via the `cloudflare:workers` virtual module:

```ts
import { env } from 'cloudflare:workers';
const cfEnv = env as unknown as Record<string, string>;

export function getNeonSql() {
  const dbUrl = cfEnv['DATABASE_URL'];
  if (!dbUrl) return null;
  return neon(dbUrl);
}
```

This ensures we can access our Cloudflare Secrets (injected securely via `wrangler secret put DATABASE_URL`) directly where we need them, without polluting our Astro components or middleware.
