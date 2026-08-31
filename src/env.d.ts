/// <reference path="../.astro/types.d.ts" />

import type { ServerTraceData } from './components/DevTraceConsole';

declare global {
	var __DEV_CONSOLE_LOG__:
		| ((
				tab: 'client' | 'neon' | 'cloudflare',
				level: 'info' | 'success' | 'warn' | 'trace',
				title: string,
				summary: string,
				detail: string | object
		  ) => void)
		| undefined;

	namespace App {
		interface Locals {
			user?: {
				id: string;
				email: string;
				name: string;
				role: string;
				avatarUrl?: string;
			} | null;
			session?: {
				id: string;
				userId: string;
				expiresAt?: string;
			} | null;
			serverTrace?: ServerTraceData;
		}
	}
}

export {};
