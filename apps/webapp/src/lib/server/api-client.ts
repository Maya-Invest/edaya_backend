import { getRequestEvent } from '$app/server';
import { API_URL } from '$env/static/private';

import { ApiError, unwrapEntity, unwrapEntityList } from '@edaya/api-client';

export { ApiError };

function isEntityCollectionPath(path: string): boolean {
	return /\/api\/core\/entities\/[^/]+\/(list|one|save)$/.test(path);
}

function isEntityGetPath(path: string): boolean {
	return /\/api\/core\/entities\/[^/]+\/[^/]+$/.test(path)
		&& !path.endsWith('/list')
		&& !path.endsWith('/one')
		&& !path.endsWith('/save')
		&& !path.endsWith('/count')
		&& !path.endsWith('/delete')
		&& !path.endsWith('/batch-save')
		&& !path.endsWith('/batch-delete');
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

	const json = await response.json();
	if (isEntityCollectionPath(path)) {
		return (Array.isArray(json) ? unwrapEntityList(json) : unwrapEntity(json)) as T;
	}
	if (isEntityGetPath(path)) {
		return unwrapEntity(json) as T;
	}
	return json as T;
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
