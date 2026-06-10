import { authSession } from '$lib/auth/session.svelte';
import { staff, type StaffMember, type StaffRole } from '$lib/data/school';

export function getCurrentUser(): StaffMember {
	const sessionUser = authSession.user;
	if (sessionUser) return sessionUser;
	return staff[0];
}

export function getCurrentRole(): StaffRole {
	return getCurrentUser().role;
}

type Ctx = { classId?: string; subject?: string };

export function canEditGrades(ctx: Ctx = {}): boolean {
	const u = getCurrentUser();
	switch (u.role) {
		case 'directeur':
			return true;
		case 'prof_principal':
			if (ctx.classId && u.mainClassId === ctx.classId) return true;
			return inTeachingScope(u, ctx);
		case 'professeur':
			return inTeachingScope(u, ctx);
		case 'educateur':
			return false;
	}
}

export function canViewGrades(_ctx: Ctx = {}): boolean {
	return true;
}

export function canEditSchoolLife(_ctx: Ctx = {}): boolean {
	const r = getCurrentRole();
	return r === 'directeur' || r === 'educateur' || r === 'prof_principal';
}

export function canEditReportsAndOrientation(ctx: Ctx = {}): boolean {
	const u = getCurrentUser();
	if (u.role === 'directeur') return true;
	if (u.role === 'prof_principal' && ctx.classId && u.mainClassId === ctx.classId) return true;
	return false;
}

function inTeachingScope(u: StaffMember, ctx: Ctx): boolean {
	if (ctx.classId && !u.classes.includes(ctx.classId)) return false;
	if (ctx.subject && !(u.subjectsTaught ?? []).includes(ctx.subject)) return false;
	return true;
}

export const ROLE_LABEL_FR: Record<StaffRole, string> = {
	directeur: 'Directeur',
	prof_principal: 'Professeur principal',
	professeur: 'Professeur',
	educateur: 'Éducateur',
};

export const ROLE_LABEL_EN: Record<StaffRole, string> = {
	directeur: 'Principal',
	prof_principal: 'Lead teacher',
	professeur: 'Teacher',
	educateur: 'Educator',
};
