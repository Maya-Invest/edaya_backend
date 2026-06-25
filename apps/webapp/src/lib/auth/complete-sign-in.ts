import { bootstrapSession } from '$lib/auth/bootstrap';
import { resetAppShellBootstrap } from '$lib/auth/bootstrap-app';
import { authSession } from '$lib/auth/session.svelte';
import { t } from '$lib/i18n';
import { appGoto, appPath } from '$lib/navigation/app-navigation';
import { toast } from '$lib/toast.svelte';
import { get } from 'svelte/store';

export async function completeAuthSignIn(successMessage?: string): Promise<boolean> {
	resetAppShellBootstrap();
	const { session } = await bootstrapSession();
	if (!session) {
		toast.error(get(t)('auth.sessionUnavailable'));
		return false;
	}

	if (successMessage) {
		toast.success(successMessage);
	}

	const target = session.kind === 'staff' && authSession.user?.role === 'directeur'
		? appPath('/(app)/dashboard')
		: appPath('/(app)/school/students/[[id]]');
	appGoto(target);
	return true;
}

export function redirectPathIfLoggedIn(): string | null {
	if (!authSession.ready || !authSession.isLoggedIn) {
		return null;
	}

	return authSession.user?.role === 'directeur'
		? appPath('/(app)/dashboard')
		: appPath('/(app)/school/students/[[id]]');
}
