import type { ResolvedPathname, RouteId } from '$app/types';
import { goto as kitGoto } from '$app/navigation';
import { resolve } from '$app/paths';

type AppGotoOptions = NonNullable<Parameters<typeof kitGoto>[1]>;

export function appGoto(href: ResolvedPathname, opts?: AppGotoOptions) {
	// href is already resolved via appPath(); kitGoto receives a ResolvedPathname.
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- central navigation wrapper
	return kitGoto(href, opts);
}

export function appPath(
	route: RouteId,
	params?: Record<string, string | undefined>,
): ResolvedPathname {
	return resolve(route, params as never) as ResolvedPathname;
}

const CLASS_SEGMENTS: Record<string, RouteId> = {
	'students': '/(app)/classes/[classId]/students/[[id]]',
	'subjects': '/(app)/classes/[classId]/subjects/[[id]]',
	'timetable': '/(app)/classes/[classId]/timetable/[[id]]',
	'teaching': '/(app)/classes/[classId]/teaching/[[id]]',
	'evaluations': '/(app)/classes/[classId]/evaluations/[[id]]',
	'report-cards': '/(app)/classes/[classId]/report-cards/[[id]]',
};

export function classItemHref(classId: string, segment: string): ResolvedPathname {
	const route = CLASS_SEGMENTS[segment] ?? '/(app)/classes/[classId]/students/[[id]]';
	return appPath(route, { classId });
}
