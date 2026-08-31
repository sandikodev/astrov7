---
title: Route caching on Cloudflare with cacheCloudflare()
description: How Astro's new platform-agnostic cache API maps to Cloudflare CDN headers, cache tags, and edge invalidation.
pubDate: 2026-08-24
tags: ['caching', 'cloudflare', 'performance']
---

A request hitting your Worker every time is a sign of missing caching, not a sign of a good server. Cloudflare's edge is fast, but it is still slower than Cloudflare's *cache*.

Astro 7 introduced a **platform-agnostic route cache API**. Your code calls `Astro.cache.set({ maxAge: 300, swr: 60, tags: ['weather'] })` once, and the adapter translates that into `Cloudflare-CDN-Cache-Control` and `Cache-Tag` headers — the same cache that CDN assets already use.

When you need to invalidate: `await Astro.cache.invalidate({ tags: ['weather'] })` purges the entries tagged `weather` from Cloudflare's global cache. One HTTP POST to your revalidation endpoint, and your content is fresh globally.

The configuration is minimal — a few lines in `astro.config.mjs` and a single `cache.set()` call in the route handler. The framework hides the header semantics; you write intent, not headers. The adapter converts intent into infrastructure.

This site's `/app/weather` and `/api/search` endpoints are live demonstrations of this behavior — open your browser's network tab and look for the `cache-tag` header.