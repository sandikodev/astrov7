// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { cacheCloudflare } from '@astrojs/cloudflare/cache';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	output: 'static',
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
		optimizeDeps: {
			include: ['preact', 'preact/hooks', 'preact/compat', 'preact-render-to-string'],
			exclude: ['@astrojs/cloudflare'],
		},
		ssr: {
			noExternal: ['preact', 'preact/hooks', 'preact/compat', 'preact-render-to-string', '@astrojs/preact'],
		},
		resolve: {
			dedupe: ['preact', 'preact/hooks', 'preact/compat'],
		},
	},
});