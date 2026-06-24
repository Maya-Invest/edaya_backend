import type { SessionSnapshot } from '$lib/auth/types';
import { browserFetch } from '$lib/api/browser-fetch';
import {
	fetchGuardianNotificationSettings,
	fetchStaffSubjectId,
} from '$lib/api/account-data';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { fetchStaffMemberById } from '$lib/api/staff-data';
import { ApiError } from '@edaya/api-client';
import { authClient } from './client';
import { authSession } from './session.svelte';

export async function bootstrapSession() {
	authSession.markLoading();
	try {
		const { data: auth } = await authClient.getSession();
		if (!auth?.session) {
			authSession.clear();
			return { session: null, staffProfile: null };
		}

		const loginEmail = auth.user.email ?? null;
		const session = await browserFetch<SessionSnapshot>('/core/authorization/effective-grants');
		const client = getBrowserSchoolClient();
		let staffProfile = null;
		let guardianSettings = null;
		let subjectId: string | null = null;

		if (session?.kind === 'staff') {
			staffProfile = await fetchStaffMemberById(
				client,
				session.actorId,
				session.schoolId,
			);
			const staff = await fetchStaffSubjectId(client, session.actorId);
			subjectId = staff.subjectId;
		}
		else if (session?.kind === 'guardian') {
			guardianSettings = await fetchGuardianNotificationSettings(client, session.actorId);
			subjectId = guardianSettings?.subjectId ?? null;
		}

		authSession.setFromServer(session, {
			staffProfile,
			guardianSettings,
			subjectId,
			loginEmail,
		});
		return { session, staffProfile, guardianSettings };
	}
	catch (error) {
		if (error instanceof ApiError && error.status === 401) {
			try {
				await authClient.signOut();
			}
			catch {
				// Ignore sign-out errors while clearing a stale session.
			}
			authSession.clear();
			return { session: null, staffProfile: null };
		}
		throw error;
	}
	finally {
		authSession.markReady();
	}
}
