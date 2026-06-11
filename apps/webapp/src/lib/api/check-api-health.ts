import { PUBLIC_API_URL } from '$env/static/public';
import { resolveApiUrl } from './http';

export async function checkBrowserApiHealth(): Promise<
	{ connected: true; message: string } | { connected: false }
> {
	try {
		const base = PUBLIC_API_URL || '';
		const response = await fetch(resolveApiUrl(base, '/'), { credentials: 'omit' });
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
