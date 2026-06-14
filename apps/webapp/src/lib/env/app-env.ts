import { PUBLIC_API_URL, PUBLIC_APP_ENV } from '$env/static/public';
import { dev } from '$app/environment';

export function isDemoLoginEnabled(): boolean {
	return dev || PUBLIC_APP_ENV === 'staging';
}

export function isLocalDevApi(): boolean {
	return dev && !PUBLIC_API_URL;
}
