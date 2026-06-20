import { academicContext } from '$lib/academic/context.svelte';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { authSession } from '$lib/auth/session.svelte';

function schoolId(): string {
	return authSession.schoolId ?? academicContext.schools[0]?.id ?? 'sch-edaya-central';
}

export async function registerStaffMemberMutation(input: {
	firstName: string;
	lastName: string;
	email?: string;
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const id = `stf-${Date.now().toString(36)}`;
	const result = await runMutation(() => client.commands.registerStaffMember({
		id,
		schoolId: schoolId(),
		firstName: input.firstName.trim(),
		lastName: input.lastName.trim(),
		email: input.email?.trim() || null,
		accountKind: 'human',
		isActive: true,
		serviceElevated: false,
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
	return result ? id : null;
}

export async function updateStaffMemberStatusMutation(input: {
	staffId: string;
	isActive: boolean;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const result = await runMutation(() => client.commands.updateStaffMemberStatus({
		staffId: input.staffId,
		isActive: input.isActive,
	}), { successMessage: input.successMessage });
	return result !== null;
}
