import type { OnboardingStaffInviteDraft } from '$lib/onboarding/types';
import { authSession } from '$lib/auth/session.svelte';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidStaffInviteEmail(email: string): boolean {
	return EMAIL_PATTERN.test(email.trim());
}

export function activeStaffInvites(invites: OnboardingStaffInviteDraft[]): OnboardingStaffInviteDraft[] {
	return invites.filter(invite => invite.email.trim().length > 0 || invite.role !== '');
}

export function isStaffStepValid(invites: OnboardingStaffInviteDraft[]): boolean {
	const active = activeStaffInvites(invites);
	if (active.length === 0) {
		return true;
	}

	const loginEmail = authSession.loginEmail?.trim().toLowerCase() ?? '';
	const seenEmails = new Set<string>();
	for (const invite of active) {
		if (!isValidStaffInviteEmail(invite.email) || !invite.role) {
			return false;
		}
		const normalized = invite.email.trim().toLowerCase();
		if (loginEmail && normalized === loginEmail) {
			return false;
		}
		if (seenEmails.has(normalized)) {
			return false;
		}
		seenEmails.add(normalized);
	}

	return true;
}

export function staffInviteCount(invites: OnboardingStaffInviteDraft[]): number {
	return activeStaffInvites(invites).filter(invite =>
		isValidStaffInviteEmail(invite.email) && Boolean(invite.role)).length;
}
