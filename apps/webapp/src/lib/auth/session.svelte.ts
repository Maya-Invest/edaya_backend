import type { EffectiveGrantsSnapshot, SessionSnapshot } from '$lib/auth/types';
import type { School, StaffMember } from '$lib/types/school';
import { browser } from '$app/environment';
import { authClient } from './client';

class AuthSession {
	userId = $state<string | null>(null);
	schoolId = $state<string | null>(null);
	userProfile = $state<StaffMember | null>(null);
	grants = $state<EffectiveGrantsSnapshot | null>(null);
	ready = $state(!browser);

	get isLoggedIn(): boolean {
		return Boolean(this.grants && this.userId);
	}

	user = $derived.by((): StaffMember | null => {
		return this.userProfile;
	});

	school = $derived.by((): School | null => {
		if (!this.schoolId) {
			return null;
		}
		return {
			id: this.schoolId,
			name: 'EDAYA — Campus Central',
			shortName: 'Campus Central',
			city: 'Paris',
			timeZone: 'Europe/Paris',
		};
	});

	markLoading() {
		this.ready = false;
	}

	markReady() {
		this.ready = true;
	}

	setFromServer(session: SessionSnapshot | null, staffProfile?: StaffMember | null) {
		if (!session) {
			this.clear();
			return;
		}

		this.userId = session.actorId;
		this.schoolId = session.schoolId;
		this.grants = session.effectiveGrants;
		this.userProfile = staffProfile ?? null;
		this.ready = true;
	}

	clear() {
		this.userId = null;
		this.schoolId = null;
		this.userProfile = null;
		this.grants = null;
	}

	async logout() {
		this.clear();
		if (browser) {
			try {
				await authClient.signOut();
			}
			catch {
				// Ignore sign out errors on client
			}
		}
		this.ready = true;
	}
}

export const authSession = new AuthSession();
