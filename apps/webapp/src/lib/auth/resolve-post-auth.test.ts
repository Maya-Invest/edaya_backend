import { describe, expect, it } from 'vitest';
import { createEmptyDraft, saveDraft } from '$lib/onboarding/draft-storage';
import { resolvePostAuthPath } from './resolve-post-auth';

describe('resolvePostAuthPath', () => {
	it('routes unlinked accounts to onboarding', () => {
		expect(resolvePostAuthPath({ session: null, pendingOnboarding: true })).toBe('/onboarding');
	});

	it('routes linked accounts into the app shell', () => {
		const target = resolvePostAuthPath({
			session: {
				kind: 'staff',
				actorId: 'st1',
				schoolId: 'sch1',
				effectiveGrants: { isElevated: true },
			} as never,
			pendingOnboarding: false,
			authUserId: 'user-complete',
		});

		const draft = createEmptyDraft();
		draft.wizardCompleted = true;
		saveDraft('user-complete', draft);

		expect(target.startsWith('/')).toBe(true);
		expect(target).not.toBe('/onboarding');
		expect(target).not.toBe('/login');
	});

	it('routes linked accounts back to onboarding when the wizard is incomplete', () => {
		const authUserId = 'user-incomplete';
		const draft = createEmptyDraft();
		draft.maxReachedStep = 2;
		saveDraft(authUserId, draft);

		const target = resolvePostAuthPath({
			session: {
				kind: 'staff',
				actorId: 'st1',
				schoolId: 'sch1',
				effectiveGrants: { isElevated: true },
			} as never,
			pendingOnboarding: false,
			authUserId,
		});

		expect(target).toBe('/onboarding?step=2');
	});

	it('falls back to login when there is no session and no pending onboarding', () => {
		expect(resolvePostAuthPath({ session: null, pendingOnboarding: false })).toBe('/login');
	});
});
