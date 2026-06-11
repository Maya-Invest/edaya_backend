import type { SessionSnapshot } from '$lib/auth/types';
import { browserFetch } from '$lib/api/browser-fetch';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { fetchStaffMemberById } from '$lib/api/staff-data';
import { ApiError } from '@edaya/api-client';
import { authSession } from './session.svelte';

export async function bootstrapSession() {
	authSession.markLoading();
	try {
		const session = await browserFetch<SessionSnapshot>('/core/authorization/effective-grants');
		let staffProfile = null;
		if (session?.kind === 'staff') {
			staffProfile = await fetchStaffMemberById(getBrowserSchoolClient(), session.actorId);
		}
		authSession.setFromServer(session, staffProfile);
		return { session, staffProfile };
	}
	catch (error) {
		if (error instanceof ApiError && error.status === 401) {
			authSession.clear();
			return { session: null, staffProfile: null };
		}
		throw error;
	}
	finally {
		authSession.markReady();
	}
}
