import type { PermissionCode, ScopeGrantSnapshot } from '$lib/auth/types';
import type { StaffMember, StaffRole } from '$lib/types/school';
import { authSession } from '$lib/auth/session.svelte';

interface Ctx { classId?: string; subject?: string }

/** Permissions fréquemment utilisées côté UI — alignées sur le catalogue API. */
export const Permissions = {
	STUDENT_CREATE: 'STUDENT_CREATE',
	STUDENT_UPDATE: 'STUDENT_UPDATE',
	ENROLLMENT_UPDATE: 'ENROLLMENT_UPDATE',
	PARENT_CREATE: 'PARENT_CREATE',
	PARENT_UPDATE: 'PARENT_UPDATE',
	GRADE_READ: 'GRADE_READ',
	GRADE_INPUT: 'GRADE_INPUT',
	DISCIPLINE_CREATE: 'DISCIPLINE_CREATE',
	DISCIPLINE_UPDATE: 'DISCIPLINE_UPDATE',
	ATTENDANCE_RECORD: 'ATTENDANCE_RECORD',
	CLASS_LOGBOOK_CREATE: 'CLASS_LOGBOOK_CREATE',
	REPORT_CARD_CONFIGURE: 'REPORT_CARD_CONFIGURE',
	REPORT_CARD_GENERATE: 'REPORT_CARD_GENERATE',
	REPORT_CARD_PUBLISH: 'REPORT_CARD_PUBLISH',
	STAFF_CREATE: 'STAFF_CREATE',
	STAFF_UPDATE: 'STAFF_UPDATE',
	ACCESS_CONTROL_CONFIGURE: 'ACCESS_CONTROL_CONFIGURE',
	ACCESS_CONTROL_ASSIGN: 'ACCESS_CONTROL_ASSIGN',
	PAYMENT_RECORD: 'PAYMENT_RECORD',
	PAYMENT_CANCEL: 'PAYMENT_CANCEL',
	PAYMENT_REVERSE: 'PAYMENT_REVERSE',
	FINANCIAL_CONFIG_CONFIGURE: 'FINANCIAL_CONFIG_CONFIGURE',
	FINANCIAL_CONFIG_UPDATE: 'FINANCIAL_CONFIG_UPDATE',
	SCHOOL_STRUCTURE_CONFIGURE: 'SCHOOL_STRUCTURE_CONFIGURE',
	SCHOOL_LIFECYCLE_MANAGE: 'SCHOOL_LIFECYCLE_MANAGE',
	ACADEMIC_PROGRAM_CREATE: 'ACADEMIC_PROGRAM_CREATE',
	ACADEMIC_PROGRAM_UPDATE: 'ACADEMIC_PROGRAM_UPDATE',
	TIMETABLE_UPDATE: 'TIMETABLE_UPDATE',
	RESOURCE_CONFIGURE: 'RESOURCE_CONFIGURE',
} as const satisfies Record<string, PermissionCode>;

const P = Permissions;

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

export function canCreateStudent(): boolean {
	return hasPermission(P.STUDENT_CREATE);
}

export function canUpdateStudent(): boolean {
	return hasPermission(P.STUDENT_UPDATE);
}

export function canUpdateEnrollment(): boolean {
	return hasPermission(P.ENROLLMENT_UPDATE);
}

export function canCreateGuardian(): boolean {
	return hasPermission(P.PARENT_CREATE);
}

export function canUpdateGuardian(): boolean {
	return hasPermission(P.PARENT_UPDATE);
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

export function canRecordAttendance(_ctx: Ctx = {}): boolean {
	return hasPermission(P.ATTENDANCE_RECORD);
}

export function canCreateDiscipline(_ctx: Ctx = {}): boolean {
	return hasPermission(P.DISCIPLINE_CREATE);
}

export function canEditReportsAndOrientation(ctx: Ctx = {}): boolean {
	return hasAnyPermission([P.REPORT_CARD_CONFIGURE, P.REPORT_CARD_GENERATE], ctx);
}

export function canConfigureReportCards(): boolean {
	return hasPermission(P.REPORT_CARD_CONFIGURE);
}

export function canPublishReportCards(): boolean {
	return hasPermission(P.REPORT_CARD_PUBLISH);
}

export function canGenerateReportCards(ctx: Ctx = {}): boolean {
	return hasPermission(P.REPORT_CARD_GENERATE, ctx);
}

export function canCreateStaff(): boolean {
	return hasPermission(P.STAFF_CREATE);
}

export function canUpdateStaff(): boolean {
	return hasPermission(P.STAFF_UPDATE);
}

export function canConfigureAccess(): boolean {
	return hasPermission(P.ACCESS_CONTROL_CONFIGURE);
}

export function canAssignAccess(): boolean {
	return hasPermission(P.ACCESS_CONTROL_ASSIGN);
}

export function canRecordPayment(): boolean {
	return hasPermission(P.PAYMENT_RECORD);
}

export function canConfigureFees(): boolean {
	return hasPermission(P.FINANCIAL_CONFIG_CONFIGURE);
}

export function canUpdateFinancialConfig(): boolean {
	return hasPermission(P.FINANCIAL_CONFIG_UPDATE);
}

export function canConfigureSchoolStructure(): boolean {
	return hasPermission(P.SCHOOL_STRUCTURE_CONFIGURE);
}

export function canManageAcademicLifecycle(): boolean {
	return hasPermission(P.SCHOOL_LIFECYCLE_MANAGE);
}

export function canCreateSubject(ctx: Ctx = {}): boolean {
	return hasPermission(P.ACADEMIC_PROGRAM_CREATE, ctx);
}

export function canUpdateSubject(ctx: Ctx = {}): boolean {
	return hasPermission(P.ACADEMIC_PROGRAM_UPDATE, ctx);
}

export function canUpdateTimetable(ctx: Ctx = {}): boolean {
	return hasPermission(P.TIMETABLE_UPDATE, ctx);
}

export function canConfigureResources(): boolean {
	return hasPermission(P.RESOURCE_CONFIGURE);
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
