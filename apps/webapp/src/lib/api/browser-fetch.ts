import { PUBLIC_API_URL } from '$env/static/public';
import { parseApiResponse, resolveApiUrl } from './http';

export async function browserFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	if (!headers.has('Content-Type') && init.body) {
		headers.set('Content-Type', 'application/json');
	}
	if (!headers.has('Accept')) {
		headers.set('Accept', 'application/json');
	}

	const base = PUBLIC_API_URL || '';
	const response = await fetch(resolveApiUrl(base, path), {
		...init,
		headers,
		credentials: 'include',
	});

	return parseApiResponse<T>(path, response);
}
