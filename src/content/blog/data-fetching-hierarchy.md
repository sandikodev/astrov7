---
title: The data-fetching hierarchy in Astro
description: "Choose the cheapest place to fetch: build time, on-demand server, cached endpoint, or the browser. Never just pick the browser."
pubDate: 2026-08-10
tags: ['fetch', 'performance', 'patterns']
---

Fetching in the browser is the most expensive place to get data — every byte travels to the client and back, and the page ships a JavaScript payload to orchestrate it. Astro gives you progressively cheaper options.

**Read this as a checklist, in order:**

1. **Build time.** Content collections, or `await fetch()` in a static page's frontmatter. Output is plain HTML. Zero runtime cost.
2. **On-demand server.** A `prerender = false` page fetches server-side and streams results. The browser only receives rendered markup.
3. **Cached endpoint.** An API route that fetches upstream once, then lets `Astro.cache` serve CDN hits. Your worker runs on a miss or a revalidation. Good for data shared across pages.
4. **Server islands.** A dynamic widget that re-renders server-side on each request, without shipping any client JavaScript.
5. **Client fetch.** Last resort — interactive islands that need user input. Use it only for things that must live in the browser, like a debounced search.

The webapp half of this site walks all five layers with real code.