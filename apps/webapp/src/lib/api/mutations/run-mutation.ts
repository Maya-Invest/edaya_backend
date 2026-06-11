import { bootstrapAppShell, resetAppShellBootstrap } from '$lib/auth/bootstrap-app';
import { toast } from '$lib/toast.svelte';
import { ApiError } from '@edaya/api-client';

function messageFromApiError(error: ApiError): string | undefined {
	if (error.body && typeof error.body === 'object') {
		const body = error.body as Record<string, unknown>;
		if (typeof body.message === 'string') {
			return body.message;
		}
		if (typeof body.error === 'string') {
			return body.error;
		}
	}
	return undefined;
}

export async function runMutation<T>(
	fn: () => Promise<T>,
	options?: {
		refresh?: boolean;
		errorMessage?: string;
	},
): Promise<T | null> {
	try {
		const result = await fn();
		if (options?.refresh !== false) {
			resetAppShellBootstrap();
			await bootstrapAppShell();
		}
		return result;
	}
	catch (error) {
		const message = error instanceof ApiError
			? messageFromApiError(error) ?? options?.errorMessage ?? 'La requête a échoué.'
			: options?.errorMessage ?? 'La requête a échoué.';
		toast.error(message);
		return null;
	}
}
