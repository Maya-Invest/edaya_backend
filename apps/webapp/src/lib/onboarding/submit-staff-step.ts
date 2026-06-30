import type { OnboardingStaffInviteDraft } from '$lib/onboarding/types';
import { browserFetch } from '$lib/api/browser-fetch';
import { bootstrapAppShell, resetAppShellBootstrap } from '$lib/auth/bootstrap-app';
import { t } from '$lib/i18n';
import { staffInvitesForSubmit } from '$lib/onboarding/staff-step-helpers';
import { toast } from '$lib/toast.svelte';
import { ApiError } from '@edaya/api-client';
import { get } from 'svelte/store';

interface InviteStaffResponse {
	invitedCount: number;
	accessRolesEnsured: number;
}

function messageFromError(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.body && typeof error.body === 'object') {
			const body = error.body as Record<string, unknown>;
			if (body.code === 'STAFF_INVITE_OWNER_EMAIL') {
				return get(t)('onboarding.staffStep.ownerEmail');
			}
			if (body.code === 'INVITE_BASE_URL_MISSING') {
				return get(t)('onboarding.staffStep.inviteUrlMissing');
			}
			if (typeof body.message === 'string' && body.message.length > 0) {
				return body.message;
			}
		}
	}
	return get(t)('onboarding.staffStep.failed');
}

export async function submitStaffOnboardingStep(
	invites: OnboardingStaffInviteDraft[],
	options: { alreadySubmitted: boolean },
): Promise<boolean> {
	if (options.alreadySubmitted) {
		return true;
	}

	const payload = staffInvitesForSubmit(invites);
	if (payload.length === 0) {
		return true;
	}

	try {
		const result = await browserFetch<InviteStaffResponse>('/core/onboarding/invite-staff-members', {
			method: 'POST',
			body: JSON.stringify({ invites: payload }),
		});

		resetAppShellBootstrap();
		await bootstrapAppShell();

		toast.success(get(t)('onboarding.staffStep.success', { count: result.invitedCount }));
		return true;
	}
	catch (error) {
		toast.error(messageFromError(error));
		return false;
	}
}
