import type { components } from '$lib/api/schema';
import type { Transport } from '@edaya/api-client';
import { getRequestEvent } from '$app/server';
import { API_URL } from '$env/static/private';
import { ApiError, createSchoolClient } from '@edaya/api-client';

function createTransport(): Transport {
	return {
		async request<T>(method: string, path: string, options?: { body?: unknown }): Promise<T> {
			const headers = new Headers({ Accept: 'application/json' });
			if (options?.body !== undefined) {
				headers.set('Content-Type', 'application/json');
			}

			const event = getRequestEvent();
			const cookie = event?.request.headers.get('cookie');
			if (cookie) {
				headers.set('Cookie', cookie);
			}

			const yearId = event?.request.headers.get('x-academic-year-id');
			if (yearId) {
				headers.set('X-Academic-Year-Id', yearId);
			}

			const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
			const response = await fetch(url, {
				method,
				headers,
				body: options?.body === undefined ? undefined : JSON.stringify(options.body),
			});

			if (!response.ok) {
				let body: unknown;
				try {
					body = await response.json();
				}
				catch {
					body = await response.text();
				}
				throw new ApiError(response.status, body);
			}

			if (response.status === 204) {
				return undefined as T;
			}

			return response.json() as Promise<T>;
		},
	};
}

let schoolClient: ReturnType<typeof createSchoolClient<components['schemas']>> | undefined;

export function getSchoolClient() {
	schoolClient ??= createSchoolClient<components['schemas']>(createTransport());
	return schoolClient;
}
