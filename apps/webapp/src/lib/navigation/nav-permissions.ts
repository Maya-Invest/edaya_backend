import type { EffectiveGrantsSnapshot, PermissionCode } from '$lib/auth/types';
import {
	NAV_MODULE_DEFS,
	type NavItemDefinition,
	type NavModuleKey,
} from '$lib/navigation/nav-catalog';
import { checkAnyPermission } from '$lib/permission-check';

export interface NavPermissionContext {
	classId?: string;
	schoolId?: string;
}

const MODULE_ORDER: NavModuleKey[] = ['school', 'classes', 'finance', 'configuration'];

function resolveNavContext(ctx: NavPermissionContext = {}) {
	return {
		classId: ctx.classId,
		schoolId: ctx.schoolId ?? '',
	};
}

export function canAccessNavItem(
	item: Pick<NavItemDefinition, 'permissions'>,
	grants: EffectiveGrantsSnapshot | null,
	ctx: NavPermissionContext = {},
): boolean {
	if (!item.permissions?.length) {
		return true;
	}
	return checkAnyPermission(grants, item.permissions, resolveNavContext(ctx));
}

export function filterNavItems<T extends Pick<NavItemDefinition, 'permissions'>>(
	items: readonly T[],
	grants: EffectiveGrantsSnapshot | null,
	ctx: NavPermissionContext = {},
): T[] {
	return items.filter(item => canAccessNavItem(item, grants, ctx));
}

export function visibleNavModuleKeys(
	grants: EffectiveGrantsSnapshot | null,
	ctx: NavPermissionContext = {},
): NavModuleKey[] {
	const schoolCtx = { schoolId: ctx.schoolId };
	return MODULE_ORDER.filter((moduleKey) => {
		return filterNavItems(NAV_MODULE_DEFS[moduleKey], grants, schoolCtx).length > 0;
	});
}

function resolveItemHref(item: NavItemDefinition, classId: string): string {
	if (item.classSegment) {
		return `/classes/${classId}/${item.href}`;
	}
	return item.href;
}

function pathnameMatchesItem(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItemForPath(pathname: string, classId?: string): NavItemDefinition | null {
	if (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname.startsWith('/account')) {
		return null;
	}

	for (const moduleKey of MODULE_ORDER) {
		for (const item of NAV_MODULE_DEFS[moduleKey]) {
			const href = moduleKey === 'classes' && classId
				? resolveItemHref(item, classId)
				: item.href;
			if (pathnameMatchesItem(pathname, href)) {
				return item;
			}
		}
	}

	return null;
}

export function canAccessPath(
	pathname: string,
	grants: EffectiveGrantsSnapshot | null,
	ctx: NavPermissionContext = {},
): boolean {
	if (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname.startsWith('/account')) {
		return true;
	}

	const classId = ctx.classId ?? extractClassIdFromPath(pathname);
	const item = findNavItemForPath(pathname, classId);
	if (!item) {
		return true;
	}

	const itemCtx = pathname.startsWith('/classes/') && classId
		? { schoolId: ctx.schoolId }
		: { schoolId: ctx.schoolId };
	return canAccessNavItem(item, grants, itemCtx);
}

function extractClassIdFromPath(pathname: string): string | undefined {
	const match = /^\/classes\/([^/]+)/.exec(pathname);
	return match?.[1];
}

/** Dev seed `role-teacher` permissions — used in unit tests for profile 3.2. */
export const TEACHER_NAV_PERMISSIONS: readonly PermissionCode[] = [
	'CLASS_LOGBOOK_CREATE',
	'ATTENDANCE_RECORD',
	'DISCIPLINE_CREATE',
	'GRADE_INPUT',
	'CLASS_LOGBOOK_UPDATE',
	'GRADE_READ',
	'QUERY_WORKSPACE_READ',
	'QUERY_CLASS_DIRECTORY_READ',
	'QUERY_ENROLLMENT_HISTORY_READ',
	'QUERY_CLASS_CURRICULUM_READ',
	'QUERY_OVERVIEW_READ',
	'QUERY_OVERDUE_FEES_READ',
	'QUERY_STUDENT_DIRECTORY_READ',
	'QUERY_GUARDIAN_STUDENTS_ADMIN_READ',
	'STUDENT_READ',
	'PARENT_READ',
	'QUERY_TIMETABLE_READ',
	'RESOURCE_READ',
	'QUERY_CALENDAR_READ',
	'QUERY_ATTENDANCE_READ',
	'ATTENDANCE_READ',
	'DISCIPLINE_READ',
	'QUERY_STUDENT_DETAIL_READ',
	'CLASS_LOGBOOK_READ',
	'STUDENT_HEALTH_READ',
	'QUERY_REPORT_CARD_DETAIL_READ',
];

/** @deprecated Use `visibleNavModuleKeys`. Kept for dev HMR compatibility. */
export const visibleNavModules = visibleNavModuleKeys;
