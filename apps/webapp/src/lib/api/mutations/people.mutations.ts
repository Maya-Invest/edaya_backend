import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { detailDataContext } from '$lib/detail-data/context.svelte';

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

		return client.commands.updateGuardianContactMethods({
			guardianId: input.guardianId,
			firstName: input.firstName.trim(),
			lastName: input.lastName.trim(),
			email: email || null,
			phone: phone || null,
			contactMethods,
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
