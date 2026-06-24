import { academicContext } from '$lib/academic/context.svelte';
import {
	fetchGuardianNotificationSettings,
	fetchStaffSubjectId,
	type GuardianNotificationSettings,
} from '$lib/api/account-data';
import { entitiesByIds } from '$lib/api/entity-list-filters';
import { fetchInboxDeliveries, type InboxDelivery } from '$lib/api/notifications-inbox-data';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { authSession } from '$lib/auth/session.svelte';
import { resolvePageLoad } from '$lib/queries/page-status';

export interface NotificationSettingsPageData {
	settings: GuardianNotificationSettings | null;
	staffEmail: string | null;
	studentNames: Record<string, string>;
	kind: 'staff' | 'guardian' | 'student' | null;
}

export interface InboxPageData {
	deliveries: InboxDelivery[];
	subjectId: string | null;
}

export function queryNotificationSettingsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: (): NotificationSettingsPageData => ({
			settings: null,
			staffEmail: null,
			studentNames: {},
			kind: authSession.sessionKind,
		}),
		load: async (): Promise<NotificationSettingsPageData> => {
			const client = getBrowserSchoolClient();
			const kind = authSession.sessionKind;
			const actorId = authSession.userId;
			if (!kind || !actorId) {
				return { settings: null, staffEmail: null, studentNames: {}, kind };
			}
			if (kind === 'guardian') {
				const settings = await fetchGuardianNotificationSettings(client, actorId);
				const studentIds = settings?.links.map(link => link.studentId) ?? [];
				const students = studentIds.length > 0
					? await client.entities.students.list(entitiesByIds(studentIds))
					: [];
				const studentNames = Object.fromEntries(
					(students ?? []).map(student => [
						student.id,
						`${student.firstName} ${student.lastName}`,
					]),
				);
				return { settings, staffEmail: null, studentNames, kind };
			}
			if (kind === 'staff') {
				const staff = await fetchStaffSubjectId(client, actorId);
				return { settings: null, staffEmail: staff.email, studentNames: {}, kind };
			}
			return { settings: null, staffEmail: null, studentNames: {}, kind };
		},
		hasItems: data => Boolean(data.settings) || data.kind === 'staff',
		errorMessage: 'Unable to load notification settings.',
	});
}

export function queryInboxPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: (): InboxPageData => ({
			deliveries: [],
			subjectId: authSession.subjectId,
		}),
		load: async (): Promise<InboxPageData> => {
			const subjectId = authSession.subjectId;
			if (!subjectId) {
				return { deliveries: [], subjectId: null };
			}
			const deliveries = await fetchInboxDeliveries(
				getBrowserSchoolClient(),
				subjectId,
				authSession.schoolId ?? academicContext.schools[0]?.id ?? '',
			);
			return { deliveries, subjectId };
		},
		hasItems: data => data.deliveries.length > 0,
		errorMessage: 'Unable to load your inbox.',
	});
}
