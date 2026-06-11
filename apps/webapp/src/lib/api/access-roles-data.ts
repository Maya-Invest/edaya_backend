import type { components } from '$lib/api/schema';
import type { Crud } from '$lib/components/school/drawer-constants';
import type { StaffRole } from '$lib/data/school';
import { ROLE_PERMISSIONS, STAFF_PERMISSIONS } from '$lib/components/school/drawer-constants';
import type { getBrowserSchoolClient } from '$lib/api/school-client';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

type AccessRoleRaw = components['schemas']['AccessRole'];

export const ACCESS_ROLE_ID_TO_STAFF_ROLE: Record<string, StaffRole> = {
	'role-director': 'directeur',
	'role-coordinator': 'prof_principal',
	'role-teacher': 'professeur',
	'role-educator': 'educateur',
};

const UI_PERMISSION_API_RULES: Record<string, Partial<Record<Crud, string[]>>> = {
	'grades.edit': {
		C: ['GRADE_INPUT'],
		R: ['GRADE_READ'],
		U: ['GRADE_INPUT', 'GRADE_UPDATE'],
		D: ['GRADE_LOCK'],
	},
	'grades.view': {
		R: ['GRADE_READ', 'QUERY_REPORT_CARD_DETAIL_READ'],
	},
	'reports.edit': {
		C: ['REPORT_CARD_GENERATE'],
		R: ['REPORT_CARD_READ', 'QUERY_REPORT_CARD_DETAIL_READ'],
		U: ['REPORT_CARD_CONFIGURE', 'REPORT_CARD_PUBLISH', 'REPORT_CARD_GENERATE'],
		D: ['REPORT_CARD_LOCK'],
	},
	'records.edit': {
		C: ['CLASS_LOGBOOK_CREATE', 'STUDENT_CREATE'],
		R: ['STUDENT_READ', 'QUERY_STUDENT_DETAIL_READ', 'CLASS_LOGBOOK_READ'],
		U: ['STUDENT_UPDATE', 'CLASS_LOGBOOK_UPDATE', 'STUDENT_HEALTH_UPDATE'],
		D: ['STUDENT_ARCHIVE'],
	},
	'life.absences': {
		C: ['ATTENDANCE_RECORD'],
		R: ['ATTENDANCE_READ', 'QUERY_ATTENDANCE_READ'],
		U: ['ATTENDANCE_UPDATE', 'ATTENDANCE_JUSTIFY'],
		D: ['ATTENDANCE_VALIDATE'],
	},
	'life.tardiness': {
		C: ['ATTENDANCE_RECORD'],
		R: ['ATTENDANCE_READ', 'QUERY_ATTENDANCE_READ'],
		U: ['ATTENDANCE_UPDATE'],
	},
	'life.discipline': {
		C: ['DISCIPLINE_CREATE'],
		R: ['DISCIPLINE_READ'],
		U: ['DISCIPLINE_UPDATE', 'DISCIPLINE_VALIDATE'],
		D: ['DISCIPLINE_ARCHIVE'],
	},
	'staff.manage': {
		C: ['STAFF_CREATE', 'ACCESS_CONTROL_ASSIGN'],
		R: ['STAFF_READ', 'ACCESS_CONTROL_READ'],
		U: ['STAFF_UPDATE', 'ACCESS_CONTROL_CONFIGURE'],
		D: ['STAFF_ARCHIVE'],
	},
	'finance.manage': {
		C: ['PAYMENT_RECORD'],
		R: ['FINANCIAL_CONFIG_READ', 'PAYMENT_READ', 'QUERY_OVERDUE_FEES_READ'],
		U: ['FINANCIAL_CONFIG_UPDATE', 'FINANCIAL_CONFIG_CONFIGURE'],
		D: ['PAYMENT_CANCEL'],
	},
	'config.school': {
		C: ['ACADEMIC_PROGRAM_CREATE', 'TIMETABLE_CREATE', 'RESOURCE_CONFIGURE'],
		R: ['SCHOOL_STRUCTURE_READ', 'ACADEMIC_PROGRAM_READ', 'TIMETABLE_READ', 'RESOURCE_READ'],
		U: ['SCHOOL_STRUCTURE_CONFIGURE', 'EXAM_CONFIG_CONFIGURE', 'TIMETABLE_UPDATE', 'ACADEMIC_PROGRAM_UPDATE'],
		D: ['ACADEMIC_PROGRAM_DELETE'],
	},
};

function hasAnyPermission(granted: Set<string>, candidates: string[] | undefined): boolean {
	if (!candidates || candidates.length === 0) {
		return false;
	}
	return candidates.some(permission => granted.has(permission));
}

export function buildRoleCrudMatrix(permissions: readonly string[]): Record<string, Record<Crud, boolean>> {
	const granted = new Set(permissions);
	const matrix: Record<string, Record<Crud, boolean>> = {};

	for (const permission of ROLE_PERMISSIONS) {
		const rules = UI_PERMISSION_API_RULES[permission.key] ?? {};
		matrix[permission.key] = {
			C: hasAnyPermission(granted, rules.C),
			R: hasAnyPermission(granted, rules.R),
			U: hasAnyPermission(granted, rules.U),
			D: hasAnyPermission(granted, rules.D),
		};
	}

	return matrix;
}

export function buildRoleEnabledPermissions(permissions: readonly string[]): Record<string, boolean> {
	const crudMatrix = buildRoleCrudMatrix(permissions);
	return Object.fromEntries(
		STAFF_PERMISSIONS.map(permission => [
			permission.key,
			Object.values(crudMatrix[permission.key] ?? {}).some(Boolean),
		]),
	);
}

export function mapAccessRolesToStaffRoles(
	accessRolesRaw: AccessRoleRaw[],
): Partial<Record<StaffRole, AccessRoleRaw>> {
	const mapped: Partial<Record<StaffRole, AccessRoleRaw>> = {};

	for (const role of accessRolesRaw) {
		const staffRole = ACCESS_ROLE_ID_TO_STAFF_ROLE[role.id];
		if (staffRole) {
			mapped[staffRole] = role;
		}
	}

	return mapped;
}

export async function loadAccessRolesData(client: SchoolClient): Promise<{
	accessRoles: AccessRoleRaw[];
	roleCrudMatrix: Partial<Record<StaffRole, Record<string, Record<Crud, boolean>>>>;
	roleEnabledPermissions: Partial<Record<StaffRole, Record<string, boolean>>>;
}> {
	const accessRoles = await client.entities.accessRoles.list({});

	const roleCrudMatrix: Partial<Record<StaffRole, Record<string, Record<Crud, boolean>>>> = {};
	const roleEnabledPermissions: Partial<Record<StaffRole, Record<string, boolean>>> = {};

	for (const [accessRoleId, staffRole] of Object.entries(ACCESS_ROLE_ID_TO_STAFF_ROLE)) {
		const role = accessRoles?.find(entry => entry.id === accessRoleId);
		if (!role) {
			continue;
		}
		roleCrudMatrix[staffRole] = buildRoleCrudMatrix(role.permissions);
		roleEnabledPermissions[staffRole] = buildRoleEnabledPermissions(role.permissions);
	}

	return {
		accessRoles: accessRoles ?? [],
		roleCrudMatrix,
		roleEnabledPermissions,
	};
}
