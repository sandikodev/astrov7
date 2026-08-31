# Agent Instructions — astrov7 (Astro v7 × Cloudflare Workers × Neon Ecosystem)

This repository is a production-grade reference implementation for Astro v7 deployed on Cloudflare Workers with Neon Serverless Postgres, Neon Auth, and Neon Object Storage.

---

## 🛠️ Development & Dev Server Rules

When starting or managing the dev server, ALWAYS use background mode:

```bash
astro dev --background
```

Manage the background server with:
- `astro dev status` — Check status
- `astro dev logs` — View logs
- `astro dev stop` — Stop dev server

---

## 🏗️ Architecture & Core Rules

1. **Hybrid Rendering Topology**:
   - Default output is `output: 'static'` in `astro.config.mjs`.
   - Static pages (`/`, `/blog/*`, `/404`) compile to static files in `dist/client/`.
   - On-demand app pages (`/app/*`, `/api/*`, `/auth/*`) MUST export `export const prerender = false`.

2. **Single Source of Truth Path Aliases**:
   - Path aliases MUST be defined ONLY in `tsconfig.json` (`compilerOptions.paths`):
     - `@/*` → `src/*`
     - `@components/*` → `src/components/*`
     - `@layouts/*` → `src/layouts/*`
     - `@lib/*` → `src/lib/*`
     - `@content/*` → `src/content/*`
     - `@styles/*` → `src/styles/*`
     - `@pages/*` → `src/pages/*`
   - **DO NOT** add duplicate `vite.resolve.alias` entries in `astro.config.mjs`. Astro automatically inherits aliases from `tsconfig.json`.

3. **Vite 6 / workerd Edge Mitigation (GitHub Issue #17868)**:
   - To prevent `workerd` IPC pipe disconnections (`Broken pipe`) and dynamic dep wiping:
     - Keep `ssr.optimizeDeps.noDiscovery = true` in `astro.config.mjs`.
     - Keep `@astrojs/preact`, `astro/actions`, and `astro:actions` in `optimizeDeps.exclude` and `ssr.optimizeDeps.exclude`.

4. **Layout Composition Hierarchy**:
   - `BaseLayout.astro`: Universal root shell containing `<head>`, `<ClientRouter />`, CSS, and sticky `<DevTraceConsole />`.
   - `Layout.astro`: Public marketing & blog layout (composes `BaseLayout`).
   - `AppLayout.astro`: Desktop webapp app shell + mobile responsive UX (composes `BaseLayout`).
   - `AuthLayout.astro`: Full-screen ambient auth layout (composes `BaseLayout`).

---

## 💻 Key Commands

| Task | Command |
|---|---|
| Development | `bun run dev` (`wrangler types && astro dev`) |
| Type Check | `bun astro check` |
| Build | `bun run cf:build` (`wrangler types && astro check && astro build`) |
| Deploy | `bun run cf:deploy` (`cf:build` + `wrangler deploy`) |
| Preview | `bun run cf:preview` (`wrangler types && astro preview`) |

---

## 📚 Documentation Reference

- Official Astro Docs: https://docs.astro.build
- [Astro Routing Guide](https://docs.astro.build/en/guides/routing/)
- [Astro Components](https://docs.astro.build/en/basics/astro-components/)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Neon Serverless Docs](https://neon.tech/docs)
