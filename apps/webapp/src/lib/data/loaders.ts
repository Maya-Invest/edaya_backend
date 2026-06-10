import type { PageLoadMeta } from './load-state';

import { finalizeStatus, maybeSimulateLoading, resolveDemoState } from './load-state';

import {

	getRuntimeClasses,

	getRuntimeHierarchy,

	getRuntimePeriods,

	getRuntimeYears

} from '$lib/academic/context.svelte';

import {

	activities,

	billing,

	evaluations,

	fees,

	gradeLevels,

	guardians,

	incidents,

	periodDefinitions,

	planning,

	schoolYearEvents,

	schools,

	staff,

	students,

	subjects

} from './school';



type LoadInput = { url: URL; params?: Record<string, string> };



function classes() {

	return getRuntimeClasses();

}



function hierarchy() {

	return getRuntimeHierarchy();

}



export async function loadAppShell() {

	return {

		hierarchy: hierarchy(),

		studentCount: students.length,

		academicYears: getRuntimeYears(),

		academicPeriods: getRuntimePeriods(),

		gradeLevels,

		periodDefinitions,

		schools

	};

}



export async function loadSchoolStudentsPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const list = resolveDemoState(url) === 'empty' ? [] : students;

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, students: list, classes: classes(), hierarchy: hierarchy() };

}



export async function loadSchoolGuardiansPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const list = resolveDemoState(url) === 'empty' ? [] : guardians;

	const meta = finalizeStatus(url, list.length > 0);

	return { ...meta, guardians: list, students };

}



export async function loadSchoolStaffPage({ url }: LoadInput) {

	await maybeSimulateLoading(url);

	const list = resolveDemoState(url) === 'empty' ? [] : staff;

	const meta = finalizeStatus(url, list.length > 0);

	return {

		...meta,

		staff: list,

		guardians,

		students

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

