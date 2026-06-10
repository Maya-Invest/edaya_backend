import type { PageLoadMeta } from './load-state';
import { finalizeStatus, maybeSimulateLoading, resolveDemoState } from './load-state';
import {
	getRuntimeClasses,
	getRuntimeHierarchy,
	getRuntimePeriods,
	getRuntimeYears
} from '$lib/academic/context.svelte';
import { ApiError } from '$lib/server/api-client';
import {
	activities,
	academicPeriods,
	academicYears,
	billing,
	classes as seedClasses,
	evaluations,
	fees,
	gradeLevels,
	guardians,
	hierarchy as seedHierarchy,
	incidents,
	periodDefinitions,
	planning,
	schoolYearEvents,
	schools,
	staff,
	students,
	subjects
} from './school';
import { getAppShellData } from '$lib/remote/shell.remote';
import { getSchoolStudentsData, getSchoolStaffData } from '$lib/remote/people.remote';

type LoadInput = { url: URL; params?: Record<string, string>; hasSession?: boolean };

function classes() {
	return getRuntimeClasses();
}

function hierarchy() {
	return getRuntimeHierarchy();
}

export function loadMockAppShell() {
	const studentCount = students.length;
	return {
		schools,
		academicYears,
		academicPeriods,
		gradeLevels,
		periodDefinitions,
		classes: seedClasses,
		hierarchy: seedHierarchy,
		studentCount
	};
}

function isUnauthorized(error: unknown): boolean {
	if (error instanceof ApiError) {
		return error.status === 401;
	}
	if (typeof error === 'object' && error !== null) {
		const candidate = error as { status?: number; message?: string };
		if (candidate.status === 401) {
			return true;
		}
		if (candidate.message?.includes('(401)')) {
			return true;
		}
	}
	return false;
}

async function withApiFallback<T>(fetcher: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await fetcher();
	}
	catch (error) {
		if (isUnauthorized(error)) {
			return fallback;
		}
		throw error;
	}
}

export async function loadAppShell(hasSession = false) {
	if (!hasSession) {
		return loadMockAppShell();
	}
	return withApiFallback(() => getAppShellData(), loadMockAppShell());
}

export async function loadSchoolStudentsPage({ url, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);
	const list = resolveDemoState(url) === 'empty'
		? []
		: hasSession
			? await withApiFallback(() => getSchoolStudentsData(), students)
			: students;
	const meta = finalizeStatus(url, list.length > 0);
	return { ...meta, students: list, classes: classes(), hierarchy: hierarchy() };
}

export async function loadSchoolGuardiansPage({ url }: LoadInput) {
	await maybeSimulateLoading(url);
	const list = resolveDemoState(url) === 'empty' ? [] : guardians;
	const meta = finalizeStatus(url, list.length > 0);
	return { ...meta, guardians: list, students };
}

export async function loadSchoolStaffPage({ url, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);
	const list = resolveDemoState(url) === 'empty'
		? []
		: hasSession
			? await withApiFallback(() => getSchoolStaffData(), staff)
			: staff;
	const liveStudents = resolveDemoState(url) === 'empty'
		? []
		: hasSession
			? await withApiFallback(() => getSchoolStudentsData(), students)
			: students;
	const meta = finalizeStatus(url, list.length > 0);
	return {
		...meta,
		staff: list,
		guardians,
		students: liveStudents
	};
}



export async function loadSchoolActivitiesPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const list = resolveDemoState(url) === 'empty' ? [] : activities;

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, activities: list };

}



export async function loadSchoolCalendarPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const list = resolveDemoState(url) === 'empty' ? [] : schoolYearEvents;

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, events: list, classes: classes() };

}



export async function loadSchoolEventsPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const list = resolveDemoState(url) === 'empty' ? [] : incidents;

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, incidents: list, students, classes: classes() };

}



export async function loadFinancePage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const empty = resolveDemoState(url) === 'empty';

	const meta = finalizeStatus(url, !empty && (fees.length > 0 || billing.length > 0));

	return {

		...meta,

		fees: empty ? [] : fees,

		billing: empty ? [] : billing,

		students

	};

}



export async function loadPaymentsPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const empty = resolveDemoState(url) === 'empty';

	const meta = finalizeStatus(url, !empty && billing.length > 0);

	return {

		...meta,

		billing: empty ? [] : billing,

		students,

		fees,

		classes: classes()

	};

}



export async function loadRolesPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const list = resolveDemoState(url) === 'empty' ? [] : staff;

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, staff: list };

}



export async function loadConfigSubjectsPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const list = resolveDemoState(url) === 'empty' ? [] : subjects;

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, subjects: list, classes: classes() };

}



export async function loadClassStudentsPage({ url, params }: LoadInput) {

	await maybeSimulateLoading(url);

	const classList = classes();

	const classId = params?.classId ?? '6a';

	const currentClass = classList.find((c) => c.id === classId) ?? classList[0];

	const list =

		resolveDemoState(url) === 'empty'

			? []

			: students.filter((s) => s.classId === classId);

	const meta = finalizeStatus(url, list.length > 0);

	return {

		...meta,

		classId,

		currentClass,

		students: list

	};

}



export async function loadClassSubjectsPage({ url, params }: LoadInput) {

	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const list =

		resolveDemoState(url) === 'empty'

			? []

			: subjects.filter((s) => s.classId === classId);

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, classId, subjects: list };

}



export async function loadClassTimetablePage({ url, params }: LoadInput) {

	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const list =

		resolveDemoState(url) === 'empty'

			? []

			: planning.filter((p) => p.classId === classId);

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, classId, planning: list, classes: classes(), students };

}



export async function loadClassEvaluationsPage({ url, params }: LoadInput) {

	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const list =

		resolveDemoState(url) === 'empty'

			? []

			: evaluations.filter((e) => e.classId === classId);

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, classId, evaluations: list };

}



export async function loadClassTeachingPage({ url, params }: LoadInput) {

	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const list =

		resolveDemoState(url) === 'empty'

			? []

			: subjects.filter((s) => s.classId === classId);

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, classId, subjects: list };

}



export async function loadClassReportCardsPage({ url, params }: LoadInput) {

	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const classList = classes();

	const hasClass = classList.some((c) => c.id === classId);

	const meta = finalizeStatus(url, hasClass);

	return { ...meta, classId };

}

