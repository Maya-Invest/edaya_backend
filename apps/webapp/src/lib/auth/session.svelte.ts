import type { EffectiveGrantsSnapshot, SessionSnapshot } from '$lib/auth/types';
import type { AccountActor, SessionKind } from '$lib/auth/account-actor';
import type { GuardianNotificationSettings } from '$lib/api/account-data';
import type { School, StaffMember } from '$lib/types/school';
import { browser } from '$app/environment';
import { authClient } from './client';

class AuthSession {
	userId = $state<string | null>(null);
	schoolId = $state<string | null>(null);
	sessionKind = $state<SessionKind | null>(null);
	subjectId = $state<string | null>(null);
	loginEmail = $state<string | null>(null);
	userProfile = $state<StaffMember | null>(null);
	guardianSettings = $state<GuardianNotificationSettings | null>(null);
	grants = $state<EffectiveGrantsSnapshot | null>(null);
	ready = $state(!browser);

	get isLoggedIn(): boolean {
		return Boolean(this.grants && this.userId);
	}

	user = $derived.by((): StaffMember | null => {
		return this.userProfile;
	});

	accountActor = $derived.by((): AccountActor | null => {
		if (!this.userId || !this.sessionKind) {
			return null;
		}
		if (this.sessionKind === 'guardian') {
			const name = this.guardianSettings?.name ?? 'Guardian';
			return {
				id: this.userId,
				kind: 'guardian',
				name,
				initials: this.guardianSettings?.initials ?? name.slice(0, 2).toUpperCase(),
				subtitleKey: 'account.kind.guardian',
				subjectId: this.subjectId,
			};
		}
		if (this.sessionKind === 'staff') {
			return {
				id: this.userId,
				kind: 'staff',
				name: this.userProfile?.name ?? 'Staff',
				initials: this.userProfile?.initials ?? 'ST',
				subtitleKey: this.userProfile ? `staff.role.${this.userProfile.role}` : 'staff.role.professeur',
				subjectId: this.subjectId,
				email: this.userProfile?.email,
			};
		}
		return null;
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

	setFromServer(
		session: SessionSnapshot | null,
		options?: {
			staffProfile?: StaffMember | null;
			guardianSettings?: GuardianNotificationSettings | null;
			subjectId?: string | null;
			loginEmail?: string | null;
		},
	) {
		if (!session) {
			this.clear();
			return;
		}

		this.userId = session.actorId;
		this.schoolId = session.schoolId;
		this.sessionKind = session.kind;
		this.grants = session.effectiveGrants;
		this.userProfile = options?.staffProfile ?? null;
		this.guardianSettings = options?.guardianSettings ?? null;
		this.subjectId = options?.subjectId ?? null;
		this.loginEmail = options?.loginEmail ?? null;
		this.ready = true;
	}

	clear() {
		this.userId = null;
		this.schoolId = null;
		this.sessionKind = null;
		this.subjectId = null;
		this.loginEmail = null;
		this.userProfile = null;
		this.guardianSettings = null;
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
