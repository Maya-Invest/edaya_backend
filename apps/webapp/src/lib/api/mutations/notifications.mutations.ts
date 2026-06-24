import type { components } from '$lib/api/schema';
import type { GuardianNotificationSettings } from '$lib/api/account-data';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';

type GuardianContactMethod = components['schemas']['Guardian']['contactMethods'][number];

export interface GuardianNotificationPreferencesInput {
	guardianId: string;
	premiumNotificationsEnabled: boolean;
	emailNotificationsEnabled: boolean;
	smsNotificationsEnabled: boolean;
	links: Array<{
		studentId: string;
		receivesAcademicReports: boolean;
		receivesAttendanceAlerts: boolean;
	}>;
}

function mapContactMethods(
	current: GuardianContactMethod[],
	emailNotificationsEnabled: boolean,
	smsNotificationsEnabled: boolean,
): GuardianContactMethod[] {
	if (current.length === 0) {
		return current;
	}
	return current.map((method) => {
		if (method.type === 'email') {
			return { ...method, allowsNotifications: emailNotificationsEnabled };
		}
		if (method.type === 'phone' || method.type === 'sms' || method.type === 'whatsapp') {
			return { ...method, allowsNotifications: smsNotificationsEnabled };
		}
		return method;
	});
}

export async function saveGuardianNotificationPreferencesMutation(
	input: GuardianNotificationPreferencesInput,
	options?: {
		current?: GuardianNotificationSettings;
		successMessage?: string;
	},
): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const current = options?.current;
	const contactMethods = mapContactMethods(
		current?.contactMethods ?? [],
		input.emailNotificationsEnabled,
		input.smsNotificationsEnabled,
	);

	const result = await runMutation(async () => {
		await client.commands.updateGuardianContactMethods({
			guardianId: input.guardianId,
			premiumNotificationsEnabled: input.premiumNotificationsEnabled,
			contactMethods,
			hasAccess: current?.hasAccess ?? true,
		});
		for (const link of input.links) {
			const existingLink = current?.links.find(entry => entry.studentId === link.studentId);
			if (!existingLink) {
				continue;
			}
			await client.commands.updateGuardianStudentLink({
				guardianId: input.guardianId,
				studentId: link.studentId,
				relationship: existingLink.relationship,
				isPrimary: existingLink.isPrimary,
				isBillingContact: existingLink.isBillingContact,
				legalGuardian: existingLink.legalGuardian,
				canPickup: existingLink.canPickup,
				emergencyContactPriority: existingLink.emergencyContactPriority,
				receivesAcademicReports: link.receivesAcademicReports,
				receivesAttendanceAlerts: link.receivesAttendanceAlerts,
				contactRestrictions: existingLink.contactRestrictions,
				notes: existingLink.notes,
			});
		}
		return true;
	}, {
		successMessage: options?.successMessage,
	});

	return result !== null;
}

export async function markDeliveryReadMutation(deliveryId: string): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const result = await runMutation(
		() => client.commands.markDeliveryRead({ deliveryId }),
		{ errorMessage: 'Unable to mark this message as read.' },
	);
	return result !== null;
}
