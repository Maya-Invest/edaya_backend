import type { SessionSnapshot } from '$lib/auth/types';
import { authSession } from '$lib/auth/session.svelte';
import { appPath } from '$lib/navigation/app-navigation';

export const ONBOARDING_PATH = appPath('/onboarding');

export function resolveLinkedActorPath(session?: SessionSnapshot | null): string {
	const role = authSession.user?.role;
	const kind = session?.kind ?? authSession.sessionKind;

	if (kind === 'staff' && role === 'directeur') {
		return appPath('/(app)/dashboard');
	}

	return appPath('/(app)/school/students/[[id]]');
}

export function resolvePostAuthPath(options: {
	session: SessionSnapshot | null;
	pendingOnboarding: boolean;
}): string {
	if (options.pendingOnboarding) {
		return ONBOARDING_PATH;
	}

	if (!options.session) {
		return appPath('/login');
	}

	return resolveLinkedActorPath(options.session);
}

export function redirectPathIfAuthenticated(): string | null {
	if (!authSession.ready) {
		return null;
	}

	if (authSession.isLoggedIn) {
		return resolveLinkedActorPath();
	}

	if (authSession.needsOnboarding) {
		return ONBOARDING_PATH;
	}

	return null;
}
