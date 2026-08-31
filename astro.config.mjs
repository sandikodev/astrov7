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
		resolve: {
			dedupe: ['preact', 'preact/hooks', 'preact/compat'],
		},
		optimizeDeps: {
			include: [
				'preact',
				'preact/hooks',
				'preact/compat',
				'preact/devtools',
				'preact/debug',
				'preact/jsx-runtime',
				'preact-render-to-string',
			],
			exclude: [
				'@astrojs/cloudflare',
				'@astrojs/preact',
				'@astrojs/preact/server.js',
				'astro',
				'astro/actions',
				'astro:actions',
				'astro/actions/runtime/entrypoints/server.js',
				'astro/content',
				'astro:content',
				'astro/components/ClientRouter.astro',
				'astro/runtime/server/index.js',
			],
		},
		ssr: {
			optimizeDeps: {
				noDiscovery: true,
				exclude: [
					'@astrojs/cloudflare',
					'@astrojs/preact',
					'@astrojs/preact/server.js',
					'astro',
					'astro/actions',
					'astro:actions',
					'astro/actions/runtime/entrypoints/server.js',
					'astro/content',
					'astro:content',
					'astro/components/ClientRouter.astro',
					'astro/runtime/server/index.js',
				],
			},
			noExternal: [
				'preact',
				'preact/hooks',
				'preact/compat',
				'preact/devtools',
				'preact/debug',
				'preact/jsx-runtime',
				'preact-render-to-string',
			],
		},
	},
});
