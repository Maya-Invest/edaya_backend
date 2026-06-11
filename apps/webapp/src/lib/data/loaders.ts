import { getRuntimeClasses } from '$lib/academic/context.svelte';
import { finalizeStatus, maybeSimulateLoading, resolveDemoState } from './load-state';
import {
	activities,
	academicPeriods,
	academicYears,
	billing,
	classes as seedClasses,
	evaluations,
	fees,
	gradeLevels,
	hierarchy as seedHierarchy,
	incidents,
	periodDefinitions,
	planning,
	schoolYearEvents,
	schools,
	staff,
	students,
	subjects,
} from './school';

export interface LoadInput { url: URL; params?: Record<string, string>; hasSession?: boolean }

function classes() {
	return getRuntimeClasses();
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
		studentCount,
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

		students,

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

		classes: classes(),

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

export async function loadClassTimetablePage({ url, params }: LoadInput) {
	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const list

		= resolveDemoState(url) === 'empty'

			? []

			: planning.filter(p => p.classId === classId);

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, classId, planning: list, classes: classes(), students };
}

export async function loadClassEvaluationsPage({ url, params }: LoadInput) {
	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const list

		= resolveDemoState(url) === 'empty'

			? []

			: evaluations.filter(e => e.classId === classId);

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, classId, evaluations: list };
}

export async function loadClassTeachingPage({ url, params }: LoadInput) {
	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const list

		= resolveDemoState(url) === 'empty'

			? []

			: subjects.filter(s => s.classId === classId);

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, classId, subjects: list };
}

export async function loadClassReportCardsPage({ url, params }: LoadInput) {
	await maybeSimulateLoading(url);

	const classId = params?.classId ?? '6a';

	const classList = classes();

	const hasClass = classList.some(c => c.id === classId);

	const meta = finalizeStatus(url, hasClass);

	return { ...meta, classId };
}
