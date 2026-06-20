import type { PermissionCode, ScopeGrantSnapshot } from '$lib/auth/types';
import type { StaffMember, StaffRole } from '$lib/types/school';
import { authSession } from '$lib/auth/session.svelte';

interface Ctx { classId?: string; subject?: string }

const P = {
	GRADE_READ: 'GRADE_READ',
	GRADE_INPUT: 'GRADE_INPUT',
	DISCIPLINE_CREATE: 'DISCIPLINE_CREATE',
	DISCIPLINE_UPDATE: 'DISCIPLINE_UPDATE',
	ATTENDANCE_RECORD: 'ATTENDANCE_RECORD',
	CLASS_LOGBOOK_CREATE: 'CLASS_LOGBOOK_CREATE',
	REPORT_CARD_CONFIGURE: 'REPORT_CARD_CONFIGURE',
	REPORT_CARD_GENERATE: 'REPORT_CARD_GENERATE',
	TIMETABLE_UPDATE: 'TIMETABLE_UPDATE',
} as const satisfies Record<string, PermissionCode>;

function scopeGrantCovers(
	grants: readonly ScopeGrantSnapshot[],
	args: {
		permission: PermissionCode;
		schoolId: string;
		scopeType?: ScopeGrantSnapshot['scopeType'];
		scopeEntityId?: string;
		isElevated: boolean;
	},
): boolean {
	if (args.isElevated) {
		return true;
	}

	if (!args.scopeType) {
		return true;
	}

	const hasSchoolGrant = grants.some(grant =>
		grant.permission === args.permission
		&& grant.scopeType === 'school'
		&& (grant.scopeEntityIds.length === 0 || grant.scopeEntityIds.includes(args.schoolId)),
	);
	if (hasSchoolGrant) {
		return true;
	}

	const matching = grants.filter(grant =>
		grant.permission === args.permission && grant.scopeType === args.scopeType);

	if (matching.length === 0) {
		return false;
	}

	if (!args.scopeEntityId) {
		return true;
	}

	return matching.some(grant => grant.scopeEntityIds.includes(args.scopeEntityId!));
}

export function hasPermission(permission: PermissionCode, ctx: Ctx = {}): boolean {
	const grants = authSession.grants;
	if (!grants) {
		return false;
	}

	if (grants.isElevated) {
		return true;
	}

	if (!grants.permissions.includes(permission)) {
		return false;
	}

	if (!ctx.classId && !ctx.subject) {
		return true;
	}

	const schoolId = authSession.schoolId ?? '';
	return scopeGrantCovers(grants.scopeGrants, {
		permission,
		schoolId,
		scopeType: ctx.classId ? 'class_group' : 'course_assignment',
		scopeEntityId: ctx.classId ?? ctx.subject,
		isElevated: grants.isElevated,
	});
}

export function hasAnyPermission(permissions: readonly PermissionCode[], ctx: Ctx = {}): boolean {
	return permissions.some(permission => hasPermission(permission, ctx));
}

export function getCurrentUser(): StaffMember | null {
	return authSession.user;
}

export function getCurrentRole(): StaffRole {
	return getCurrentUser()?.role ?? 'professeur';
}

export function canEditGrades(ctx: Ctx = {}): boolean {
	return hasPermission(P.GRADE_INPUT, ctx);
}

export function canViewGrades(_ctx: Ctx = {}): boolean {
	return hasPermission(P.GRADE_READ);
}

export function canEditSchoolLife(_ctx: Ctx = {}): boolean {
	return hasAnyPermission([
		P.DISCIPLINE_CREATE,
		P.DISCIPLINE_UPDATE,
		P.ATTENDANCE_RECORD,
		P.CLASS_LOGBOOK_CREATE,
	]);
}

export function canEditReportsAndOrientation(ctx: Ctx = {}): boolean {
	return hasAnyPermission([P.REPORT_CARD_CONFIGURE, P.REPORT_CARD_GENERATE], ctx);
}

export function canEditTimetable(ctx: Ctx = {}): boolean {
	return hasPermission(P.TIMETABLE_UPDATE, ctx);
}

export const ROLE_LABEL_FR: Record<StaffRole, string> = {
	owner: 'Propriétaire',
	directeur: 'Directeur',
	prof_principal: 'Professeur principal',
	professeur: 'Professeur',
	educateur: 'Éducateur',
};

export const ROLE_LABEL_EN: Record<StaffRole, string> = {
	owner: 'Owner',
	directeur: 'Principal',
	prof_principal: 'Lead teacher',
	professeur: 'Teacher',
	educateur: 'Educator',
};
