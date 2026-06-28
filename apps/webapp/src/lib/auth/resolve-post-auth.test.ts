import { describe, expect, it } from 'vitest';
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
		});

		expect(target.startsWith('/')).toBe(true);
		expect(target).not.toBe('/onboarding');
		expect(target).not.toBe('/login');
	});

	it('falls back to login when there is no session and no pending onboarding', () => {
		expect(resolvePostAuthPath({ session: null, pendingOnboarding: false })).toBe('/login');
	});
});
