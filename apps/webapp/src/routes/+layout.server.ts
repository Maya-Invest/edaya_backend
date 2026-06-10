import { checkApiHealth, apiFetch } from '$lib/server/api-client';
import { fetchStaffMemberById } from '$lib/server/staff-data';
import type { SessionSnapshot } from '$lib/auth/types';
import type { StaffMember } from '$lib/data/school';

export async function load() {
	const api = await checkApiHealth();
	let session: SessionSnapshot | null = null;
	let staffProfile: StaffMember | null = null;

	if (api.connected) {
		try {
			session = await apiFetch<SessionSnapshot>('/api/core/authorization/effective-grants');
		}
		catch {
			// Not authenticated
		}
	}

	if (session?.kind === 'staff') {
		try {
			staffProfile = await fetchStaffMemberById(session.actorId);
		}
		catch {
			// Profile unavailable — session still valid
		}
	}

	return {
		api,
		session,
		staffProfile,
	};
}
