// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { cacheCloudflare } from '@astrojs/cloudflare/cache';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	output: 'static',
	markdown: {
		shikiConfig: {
			theme: 'github-dark-dimmed',
			wrap: true,
		},
	},
	env: {
		schema: {},
	},
	session: {
		ttl: 60 * 60 * 24 * 7,
		cookie: 'astrov7-session',
	},
	cache: { provider: cacheCloudflare() },
	routeRules: {
		'/api/search': { swr: 60 },
	},
	integrations: [preact({ compat: false })],
	adapter: cloudflare({
		imageService: { build: 'compile', runtime: 'cloudflare-binding' },
	}),
	vite: {
		plugins: [tailwindcss()],
		ssr: {
			optimizeDeps: {
				noDiscovery: true,
				exclude: [
					'@astrojs/cloudflare',
					'@astrojs/preact',
					'astro',
					'astro:actions'
				],
			},
		},
	},
});
