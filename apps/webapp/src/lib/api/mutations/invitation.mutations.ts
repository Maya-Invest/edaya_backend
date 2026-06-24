import type { components } from '$lib/api/schema';
import {
	cachePendingInvitation,
	clearPendingInvitation,
} from '$lib/api/invitation-cache';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';

type InvitationKind = components['schemas']['SendAccountInvitationCommand']['kind'];

export async function sendAccountInvitationMutation(input: {
	kind: InvitationKind;
	targetId: string;
	contactValue?: string;
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const result = await runMutation(
		() => client.commands.sendAccountInvitation({
			kind: input.kind,
			targetId: input.targetId,
			contactChannel: 'email',
			...(input.contactValue ? { contactValue: input.contactValue } : {}),
		}),
		{ successMessage: input.successMessage },
	);

	if (!result?.invitation?.id) {
		return null;
	}

	cachePendingInvitation(input.kind, input.targetId, result.invitation.id);
	return result.invitation.id;
}

export async function resendAccountInvitationMutation(input: {
	kind: InvitationKind;
	targetId: string;
	invitationId: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const result = await runMutation(
		() => client.commands.resendAccountInvitation({ invitationId: input.invitationId }),
		{ successMessage: input.successMessage },
	);

	if (result?.invitation?.id) {
		cachePendingInvitation(input.kind, input.targetId, result.invitation.id);
		return true;
	}
	return result !== null;
}

export async function revokeAccountInvitationMutation(input: {
	kind: InvitationKind;
	targetId: string;
	invitationId: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const result = await runMutation(
		() => client.commands.revokeAccountInvitation({ invitationId: input.invitationId }),
		{ successMessage: input.successMessage },
	);

	if (result !== null) {
		clearPendingInvitation(input.kind, input.targetId);
	}
	return result !== null;
}
