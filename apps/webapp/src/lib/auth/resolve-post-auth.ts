import type { SessionSnapshot } from '$lib/auth/types';
import { authSession } from '$lib/auth/session.svelte';
import { onboardingResumePath } from '$lib/onboarding/resume-onboarding';
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
	authUserId?: string | null;
}): string {
	if (options.pendingOnboarding) {
		return ONBOARDING_PATH;
	}

	if (!options.session) {
		return appPath('/login');
	}

	const resumePath = onboardingResumePath(
		options.authUserId ?? authSession.authUserId,
		options.session.schoolId,
	);
	if (resumePath) {
		return resumePath;
	}

	return resolveLinkedActorPath(options.session);
}

export function redirectPathIfAuthenticated(): string | null {
	if (!authSession.ready) {
		return null;
	}

	if (authSession.needsOnboarding) {
		return ONBOARDING_PATH;
	}

	if (authSession.isLoggedIn) {
		const resumePath = onboardingResumePath(authSession.authUserId, authSession.schoolId);
		if (resumePath) {
			return resumePath;
		}
		return resolveLinkedActorPath();
	}

	return null;
}
