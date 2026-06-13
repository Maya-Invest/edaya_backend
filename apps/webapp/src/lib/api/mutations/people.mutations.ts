import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';

export async function updateGuardianContactMutation(input: {
	guardianId: string;
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const result = await runMutation(async () => {
		const existing = await client.entities.guardians.get(input.guardianId);
		const email = input.email?.trim() ?? '';
		const phone = input.phone?.trim() ?? '';
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
	}, { successMessage: input.successMessage });
	return result !== null;
}
