// On-demand API endpoint with route caching (Cloudflare CDN).
// Server-side upstream fetch with timeout + typed normalization + cache tags.
import type { APIContext } from 'astro';
import { fetchJsonWithTimeout } from '@/lib/http';

export const prerender = false;

interface OpenMeteoResponse {
	current?: {
		temperature_2m?: number;
		relative_humidity_2m?: number;
		wind_speed_10m?: number;
		time?: string;
	};
	current_units?: {
		temperature_2m?: string;
		relative_humidity_2m?: string;
		wind_speed_10m?: string;
	};
}

export interface WeatherPayload {
	city: string;
	lat: number;
	lon: number;
	temperature: number | null;
	temperatureUnit: string;
	humidity: number | null;
	humidityUnit: string;
	wind: number | null;
	windUnit: string;
	observedAt: string | null;
	fetchedAt: string;
	error?: string;
}

const CITY = { name: 'Jakarta', lat: -6.2088, lon: 106.8456 };

export async function GET(context: APIContext): Promise<Response> {
	const url =
		`https://api.open-meteo.com/v1/forecast?latitude=${CITY.lat}&longitude=${CITY.lon}` +
		`&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto&forecast_days=1`;

	const result = await fetchJsonWithTimeout<OpenMeteoResponse>(url, { timeoutMs: 8000 });

	if (!result.ok) {
		const payload: WeatherPayload = {
			city: CITY.name,
			lat: CITY.lat,
			lon: CITY.lon,
			temperature: null,
			temperatureUnit: '°C',
			humidity: null,
			humidityUnit: '%',
			wind: null,
			windUnit: 'km/h',
			observedAt: null,
			fetchedAt: new Date().toISOString(),
			error: result.error,
		};
		return Response.json(payload, {
			status: 502,
			headers: { 'Cache-Control': 'no-store' },
		});
	}

	const current = result.data.current ?? {};
	const units = result.data.current_units ?? {};

	const payload: WeatherPayload = {
		city: CITY.name,
		lat: CITY.lat,
		lon: CITY.lon,
		temperature: current.temperature_2m ?? null,
		temperatureUnit: units.temperature_2m ?? '°C',
		humidity: current.relative_humidity_2m ?? null,
		humidityUnit: units.relative_humidity_2m ?? '%',
		wind: current.wind_speed_10m ?? null,
		windUnit: units.wind_speed_10m ?? 'km/h',
		observedAt: current.time ?? null,
		fetchedAt: new Date().toISOString(),
	};

	context.cache.set({ maxAge: 600, swr: 1800, tags: ['weather'] });

	return Response.json(payload);
}