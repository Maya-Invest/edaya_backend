import { dev } from '$app/environment';
import { PUBLIC_API_URL, PUBLIC_APP_ENV } from '$env/static/public';

export function isDemoLoginEnabled(): boolean {
	return dev || PUBLIC_APP_ENV === 'staging';
}

export function isLocalDevApi(): boolean {
	return dev && !PUBLIC_API_URL;
}
