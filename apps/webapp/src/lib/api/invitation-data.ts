import type { components } from '$lib/api/schema';
import { browserFetch } from '$lib/api/browser-fetch';
import { pendingAccountInvitationForTarget } from '$lib/api/entity-list-filters';
import { getBrowserSchoolClient } from '$lib/api/school-client';

export type InvitationPreview = components['schemas']['InvitationPreviewResponse'];
export type AccountInvitation = components['schemas']['AccountInvitation'];
export interface AcceptInvitationResult {
	kind: 'staff' | 'guardian' | 'student';
	entity: Record<string, unknown>;
}

export async function fetchPendingAccountInvitation(
	kind: 'staff' | 'guardian' | 'student',
	targetId: string,
): Promise<AccountInvitation | null> {
	const client = getBrowserSchoolClient();
	const invitations = await client.entities.accountInvitations.list(
		pendingAccountInvitationForTarget(kind, targetId),
	);
	return invitations[0] ?? null;
}

export async function fetchInvitationPreview(token: string): Promise<InvitationPreview> {
	return browserFetch<InvitationPreview>(`/public/invitations/${encodeURIComponent(token)}`);
}

export async function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
	return browserFetch<AcceptInvitationResult>(
		`/public/invitations/${encodeURIComponent(token)}/accept`,
		{ method: 'POST' },
	);
}
