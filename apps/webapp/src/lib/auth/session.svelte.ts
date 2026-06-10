import { browser } from '$app/environment';
import { schools, staff, type School, type StaffMember } from '$lib/data/school';

const STORAGE_USER = 'edaya:userId';
const STORAGE_SCHOOL = 'edaya:schoolId';

/** Comptes proposés sur l'écran de connexion démo. */
export const DEMO_ACCOUNTS = staff.filter((s) =>
	['st5', 'st3', 'st1', 'st7'].includes(s.id)
);

class AuthSession {
	userId = $state<string | null>(null);
	schoolId = $state<string | null>(null);
	ready = $state(false);

	constructor() {
		if (browser) this.hydrate();
		else this.ready = true;
	}

	hydrate() {
		this.userId = sessionStorage.getItem(STORAGE_USER);
		this.schoolId = sessionStorage.getItem(STORAGE_SCHOOL) ?? schools[0]?.id ?? null;
		this.ready = true;
	}

	get isLoggedIn(): boolean {
		return Boolean(this.userId);
	}

	user = $derived.by((): StaffMember | null => {
		if (!this.userId) return null;
		return staff.find((member) => member.id === this.userId) ?? null;
	});

	school = $derived.by((): School | null => {
		if (!this.schoolId) return null;
		return schools.find((entry) => entry.id === this.schoolId) ?? null;
	});

	login(userId: string, schoolId: string) {
		this.userId = userId;
		this.schoolId = schoolId;
		if (browser) {
			sessionStorage.setItem(STORAGE_USER, userId);
			sessionStorage.setItem(STORAGE_SCHOOL, schoolId);
		}
	}

	setSchool(schoolId: string) {
		this.schoolId = schoolId;
		if (browser) sessionStorage.setItem(STORAGE_SCHOOL, schoolId);
	}

	logout() {
		this.userId = null;
		if (browser) sessionStorage.removeItem(STORAGE_USER);
	}
}

export const authSession = new AuthSession();
