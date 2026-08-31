# Deployment — astrov7 on Cloudflare Workers

Everything you need to go from `git clone` to a live `*.workers.dev` site (and beyond).

---

## Prerequisites

- Node **≥ 22.12** (Astro 7 requirement).
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free plan is enough for this repo).
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
  (already a devDependency in `package.json`).

---

## 1. Authenticate

```sh
npx wrangler login
npx wrangler whoami      # sanity-check which account you're on
```

> Cloudflare and GitHub auth are **separate**. `gh auth` switches your GitHub identity;
> `wrangler login` controls the Cloudflare account your Worker deploys to.

---

## 2. Local development

```sh
bun install
bun run dev              # wrangler types && astro dev  → localhost:4321
bun run preview          # astro preview (local build)
bun run cf:preview       # astro preview on the workerd runtime (closest to prod)
```

Local bindings (KV/Images/Assets) are provided by `wrangler`/`workerd` automatically.

---

## 3. Build

```sh
bun run cf:build         # wrangler types && astro check && astro build
```

Output:

```text
dist/
├── client/              # static assets (incl. 404.html) — uploaded to Worker Assets
└── server/
    ├── entry.mjs        # the Worker script
    └── wrangler.json    # resolved config for deploy (bindings auto-injected)
```

---

## 4. Deploy

```sh
bun run cf:deploy        # full pipeline + wrangler deploy --config dist/server/wrangler.json
```

Equivalent step-by-step:

```sh
bun run cf:build
npx wrangler deploy --config dist/server/wrangler.json
```

You'll get a live URL like `https://astrov7.sandikodev.workers.dev`.

The `astrov7` worker is provisioned with:

| Binding | Type | Purpose |
|---------|------|---------|
| `ASSETS` | Static Assets | serves `dist/client` at the edge |
| `SESSION` | KV namespace | encrypted `astro:sessions` storage |
| `IMAGES` | Images binding | runtime image transforms on dynamic routes |

---

## 5. CI/CD (Workers Builds)

In the Cloudflare dashboard: **Compute → Workers & Pages → Create application → Import a repository**.

- Build command: `bun install && bun run cf:build`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`

Each push rebuilds and deploys automatically, with previews for PRs.

---

## 6. Environment variables & secrets

| Where | When | What |
|-------|------|------|
| `.env` | local `astro dev` | non-secret dev values & Neon connection strings |
| `.dev.vars` (git-ignored) | local `wrangler dev` | local secrets for workerd emulation |
| `wrangler secret put <KEY>` | production | real secrets (Cloudflare Secrets) |
| `wrangler.jsonc` → `vars` | production | non-secret constants (Data API & Auth URLs) |

To set production secrets for Neon Database, Neon Auth, and Neon Object Storage via Wrangler CLI:

```sh
npx wrangler secret put DATABASE_URL
npx wrangler secret put PUBLIC_NEON_DATA_API_URL
npx wrangler secret put PUBLIC_NEON_AUTH_URL
npx wrangler secret put NEON_AUTH_JWKS_URL
npx wrangler secret put AWS_ENDPOINT_URL_S3
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
npx wrangler secret put NEON_READONLY_API_TOKEN
```

To use a var in code, add it to `astro.config.mjs` → `env.schema` (via `envField`) and import from
`astro:env/server` (or `astro:env/client` for `PUBLIC_*`). See `.env.example` and `.dev.vars.example`.

---

## 7. Custom domain

```sh
npx wrangler deploy --config dist/server/wrangler.json        # existing worker
npx wrangler routes get                                       # see current routes
# add a custom domain in the dashboard:
#   Workers & Pages → astrov7 → Settings → Domains → Add custom domain
```

Cloudflare adds the record + free TLS automatically; no DNS config to hand-wire on your side.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Unknown URLs return a bare 404 | `assets.not_found_handling` defaults to `none`; set `"404-page"` (this repo already does) and ship `src/pages/404.astro`. |
| `[unstorage] Invalid binding SESSION: undefined` | The `SESSION` KV namespace is missing from `wrangler.jsonc` or dev server wasn't restarted. Register `"kv_namespaces": [{ "binding": "SESSION", "id": "astrov7_dev_session_kv" }]` and restart `astro dev`. |
| `workerd` IPC Panic / Broken Pipe (GitHub Issue #17868) | Module resolution failure in Vite SSR crashed the `workerd` socket. Set `ssr.optimizeDeps.noDiscovery = true` and exclude `@astrojs/preact` & `astro/actions` in `astro.config.mjs`. |
| "Hydration completed but contains mismatches" | Cloudflare **Auto Minify** rewrote HTML; disable it under site Speed/optimization settings. |
| `Could not resolve "XXX"` at build | The package uses Node APIs not supported on Workers (check `nodejs_compat` flag + Node.js compatibility docs). |
| Intermittent `Error 1102` (CPU limit) on free plan | On-demand SSR exceeded the free **10 ms CPU / invocation** budget; add `cache.set`/SWR, cache EDR; consider Workers Paid ($5/mo) for heavy SSR. |
| `Error 1027` (daily request limit) | Free plan 100,000 req/day hit; cache aggressively or upgrade. |
| Cache not purging after deploy | Use `/api/revalidate` with tags, or `wrangler deploy` replaces the whole assets namespace. |

---

## 9. GitHub metadata (if you're sharing this as a template)

Once your repo lives on GitHub (e.g. `sandikodev/astrov7`), run:

```sh
gh repo edit \
  --description "Astro v7 + Cloudflare Workers reference: static website + on-demand webapp in one deploy (sessions, actions, route caching, server islands). Live: https://astrov7.sandikodev.workers.dev" \
  --homepage "https://astrov7.sandikodev.workers.dev" \
  --add-topic astro --add-topic astrojs --add-topic astro-7 \
  --add-topic cloudflare --add-topic cloudflare-workers --add-topic workers \
  --add-topic typescript --add-topic preact --add-topic tailwindcss \
  --add-topic edge-computing --add-topic ssr --add-topic static-site \
  --add-topic server-islands --add-topic sessions --add-topic route-caching
```

Topics are what make the repo findable in community searches ("astro 7 cloudflare", "workers ssr", …).

---

## 10. Rolling back / offline

- **Rollback**: dashboard → Worker → **Deployments** → rollback to a previous version.
- **Points live URL to a static-only build**: deploy without the adapter, or set all pages to
  static — assets keep serving with **zero Worker cost**.