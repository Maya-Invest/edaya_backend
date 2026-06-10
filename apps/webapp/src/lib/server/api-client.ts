import { getRequestEvent } from '$app/server';
import { API_URL } from '$env/static/private';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: unknown,
	) {
		super(`API request failed (${status})`);
		this.name = 'ApiError';
	}
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	if (!headers.has('Content-Type') && init.body) {
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
	const response = await fetch(url, { ...init, headers });

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
}

export async function checkApiHealth(): Promise<{ connected: true; message: string } | { connected: false }> {
	try {
		const response = await fetch(`${API_URL}/`);
		if (!response.ok) {
			return { connected: false };
		}
		const health = (await response.json()) as { message: string };
		return { connected: true, message: health.message };
	}
	catch {
		return { connected: false };
	}
}
