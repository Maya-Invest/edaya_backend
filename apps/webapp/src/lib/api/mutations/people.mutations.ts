import { academicContext } from '$lib/academic/context.svelte';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { authSession } from '$lib/auth/session.svelte';

function schoolId(): string {
	return authSession.schoolId ?? academicContext.schools[0]?.id ?? 'sch-edaya-central';
}

function buildContactMethods(email: string, phone: string) {
	return [
		email
			? {
				type: 'email' as const,
				value: email,
				label: 'Email',
				isPrimary: true,
				allowsNotifications: true,
			}
			: null,
		phone
			? {
				type: 'phone' as const,
				value: phone,
				label: 'Téléphone',
				isPrimary: !email,
				allowsNotifications: true,
			}
			: null,
	].filter((method): method is NonNullable<typeof method> => method !== null);
}

export async function registerGuardianMutation(input: {
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const id = `grd-${Date.now().toString(36)}`;
	const email = input.email?.trim() ?? '';
	const phone = input.phone?.trim() ?? '';
	const result = await runMutation(() => client.commands.registerGuardian({
		id,
		schoolId: schoolId(),
		firstName: input.firstName.trim(),
		lastName: input.lastName.trim(),
		email: email || null,
		phone: phone || null,
		contactMethods: buildContactMethods(email, phone),
		hasAccess: true,
		premiumNotificationsEnabled: false,
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
	return result ? id : null;
}

export async function updateGuardianContactMutation(input: {
	guardianId: string;
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const previous = detailDataContext.guardians.find(guardian => guardian.id === input.guardianId);
	const patch = {
		name: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
		email: input.email?.trim() ?? '',
		phone: input.phone?.trim() ?? '',
	};

	const result = await runMutation(async () => {
		const existing = await client.entities.guardians.get(input.guardianId);
		const email = patch.email;
		const phone = patch.phone;
		const contactMethods = [
			email
				? {
					type: 'email' as const,
					value: email,
					label: 'Email',
					isPrimary: true,
					allowsNotifications: true,
				}
				: null,
			phone
				? {
					type: 'phone' as const,
					value: phone,
					label: 'Téléphone',
					isPrimary: !email,
					allowsNotifications: true,
				}
				: null,
		].filter((method): method is NonNullable<typeof method> => method !== null);
		const email = input.email?.trim() ?? '';
		const phone = input.phone?.trim() ?? '';

		return client.commands.updateGuardianContactMethods({
			guardianId: input.guardianId,
			firstName: input.firstName.trim(),
			lastName: input.lastName.trim(),
			email: email || null,
			phone: phone || null,
			contactMethods: buildContactMethods(email, phone),
			hasAccess: existing.hasAccess,
			premiumNotificationsEnabled: existing.premiumNotificationsEnabled,
		});
	}, {
		apply: () => detailDataContext.patchGuardian(input.guardianId, patch),
		rollback: () => {
			if (previous) {
				detailDataContext.patchGuardian(input.guardianId, {
					name: previous.name,
					email: previous.email,
					phone: previous.phone,
				});
			}
		},
		successMessage: input.successMessage,
	});
	return result !== null;
}
