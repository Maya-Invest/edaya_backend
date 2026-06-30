import { authSession } from '$lib/auth/session.svelte';
import { hasAuthGatePassed } from '$lib/auth/auth-gate';

export function shouldEnforceLoginGate(): boolean {
	if (!authSession.ready || hasAuthGatePassed()) {
		return false;
	}

	return authSession.hasAuthAccount || authSession.isLoggedIn || authSession.needsOnboarding;
}
