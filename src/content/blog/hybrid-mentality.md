---
title: Astro v7 and the hybrid mentality
description: Static-first does not mean static-only. Astro 7 lets every route opt in to the worker, one export at a time.
pubDate: 2026-08-02
tags: ['astro', 'hybrid', 'architecture']
---

Astro's rendering model is deliberately boring by default: pages are static, generated at build time. That is a feature. But "static-first" also unlocks the framework's real superpower — **near-total freedom to switch modes per route**.

Marking a page `prerender = false` moves just that page to your Cloudflare Worker. Everything else stays on the CDN edge as files. No config overhaul, no architecture flip.

The practical consequence: your landing page and blog live on the edge cache forever, while a dashboard next to them streams fresh data on every request. Both live in the same repo, same pipeline, same deployment.

This project is a live demonstration of that split: the `Website` section is fully static, the `Webapp` section is on-demand. Same site, two rendering strategies.