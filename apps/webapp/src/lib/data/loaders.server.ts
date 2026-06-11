import type { LoadInput } from './loaders';
import {
	getRuntimeClasses,
	getRuntimeHierarchy,
} from '$lib/academic/context.svelte';
import {
	getSchoolGuardiansData,
	getSchoolStaffData,
	getSchoolStudentsData,
} from '$lib/remote/people.remote';
import { getAppShellData } from '$lib/remote/shell.remote';
import { loadAccessRolesData } from '$lib/server/access-roles-data';
import { ApiError } from '$lib/server/api-client';
import { loadClassEvaluations } from '$lib/server/assessments-data';
import { loadFinanceData } from '$lib/server/finance-data';
import { loadPeopleData } from '$lib/server/people-data';
import { loadClassPlanning } from '$lib/server/planning-data';
import { loadReportCardsData } from '$lib/server/report-cards-data';
import { loadCalendarEvents, loadIncidents, loadSchoolLifeData } from '$lib/server/school-life-data';
import { loadStudent360Data } from '$lib/server/student-360-data';
import { loadClassSubjects } from '$lib/server/subjects-data';
import { finalizeStatus, maybeSimulateLoading, resolveDemoState } from './load-state';
import { loadMockAppShell,	loadFinancePage as loadMockFinancePage,	loadPaymentsPage as loadMockPaymentsPage,	loadRolesPage as loadMockRolesPage,	loadSchoolEventsPage as loadMockSchoolEventsPage } from './loaders';
import {
	gradeScales as mockGradeScales,
	reportCardDefinitions as mockReportCardDefinitions,
	reportCardResults as mockReportCardResults,
} from './report-cards';
import {
	absences,
	billing,
	evaluations,
	fees,
	guardians,
	healthRecords as mockHealthRecords,
	incidents,
	pedagogicalNotes as mockPedagogicalNotes,
	planning,
	schoolYearEvents,
	staff,
	students,
	subjects,
} from './school';

function classes() {
	return getRuntimeClasses();
}

function hierarchy() {
	return getRuntimeHierarchy();
}

function isAccessDenied(error: unknown): boolean {
	if (error instanceof ApiError) {
		return error.status === 401 || error.status === 403;
	}
	if (typeof error === 'object' && error !== null) {
		const candidate = error as { status?: number; message?: string };
		if (candidate.status === 401 || candidate.status === 403) {
			return true;
		}
		if (candidate.message?.includes('(401)') || candidate.message?.includes('(403)')) {
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
		if (isAccessDenied(error)) {
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

export async function loadSchoolGuardiansPage({ url, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);
	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, guardians: [], students: [] };
	}

	if (hasSession) {
		const live = await withApiFallback(
			() => getSchoolGuardiansData(),
			{ guardians, students },
		);
		const meta = finalizeStatus(url, live.guardians.length > 0);
		return { ...meta, guardians: live.guardians, students: live.students };
	}

	const meta = finalizeStatus(url, guardians.length > 0);
	return { ...meta, guardians, students };
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
		students: liveStudents,
	};
}

export async function loadClassStudentsPage({ url, params, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);

	const classList = classes();
	const classId = params?.classId ?? classList[0]?.id ?? '6a';
	const currentClass = classList.find(entry => entry.id === classId) ?? classList[0];

	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, classId, currentClass, students: [] };
	}

	const mockList = students.filter(student => student.classId === classId);
	const list = hasSession
		? await withApiFallback(
				async () => {
					const { students: liveStudents } = await loadPeopleData();
					return liveStudents.filter(student => student.classId === classId);
				},
				mockList,
			)
		: mockList;

	const meta = finalizeStatus(url, list.length > 0);
	return { ...meta, classId, currentClass, students: list };
}

export async function loadClassSubjectsPage({ url, params, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);

	const classList = classes();
	const classId = params?.classId ?? classList[0]?.id ?? '6a';

	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, classId, subjects: [] };
	}

	const mockList = subjects.filter(subject => subject.classId === classId);
	const list = hasSession
		? await withApiFallback(
				() => loadClassSubjects(classId),
				mockList,
			)
		: mockList;

	const meta = finalizeStatus(url, list.length > 0);
	return { ...meta, classId, subjects: list };
}

export async function loadFinancePage({ url, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);
	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, fees: [], billing: [], students: [] };
	}

	if (hasSession) {
		const live = await withApiFallback(
			async () => {
				const [{ fees: liveFees, billing: liveBilling }, { students: liveStudents }] = await Promise.all([
					loadFinanceData(),
					loadPeopleData(),
				]);
				return { fees: liveFees, billing: liveBilling, students: liveStudents };
			},
			{ fees, billing, students },
		);
		const meta = finalizeStatus(url, live.fees.length > 0 || live.billing.length > 0);
		return { ...meta, ...live };
	}

	return loadMockFinancePage({ url });
}

export async function loadPaymentsPage({ url, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);
	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, billing: [], students: [], fees: [], classes: [] };
	}

	if (hasSession) {
		const live = await withApiFallback(
			async () => {
				const [{ billing: liveBilling, fees: liveFees }, { students: liveStudents }] = await Promise.all([
					loadFinanceData(),
					loadPeopleData(),
				]);
				return {
					billing: liveBilling,
					fees: liveFees,
					students: liveStudents,
					classes: classes(),
				};
			},
			{ billing, fees, students, classes: classes() },
		);
		const meta = finalizeStatus(url, live.billing.length > 0);
		return { ...meta, ...live };
	}

	return loadMockPaymentsPage({ url });
}

export async function loadClassTimetablePage({ url, params, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);

	const classList = classes();
	const classId = params?.classId ?? classList[0]?.id ?? '6a';

	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, classId, planning: [], classes: classList, students: [] };
	}

	const mockList = planning.filter(entry => entry.classId === classId);
	const list = hasSession
		? await withApiFallback(
				() => loadClassPlanning(classId),
				mockList,
			)
		: mockList;

	const meta = finalizeStatus(url, list.length > 0);
	return { ...meta, classId, planning: list, classes: classList, students };
}

export async function loadReportCardsForLayout({ hasSession = false }: { hasSession?: boolean }) {
	if (!hasSession) {
		return {
			gradeScales: mockGradeScales,
			reportCardDefinitions: mockReportCardDefinitions,
			reportCardResults: mockReportCardResults,
		};
	}

	return withApiFallback(
		async () => {
			const live = await loadReportCardsData();
			const liveDefinitionIds = new Set(live.definitions.map(definition => definition.id));
			const liveResultIds = new Set(live.results.map(result => result.id));

			return {
				gradeScales: live.gradeScales.length > 0 ? live.gradeScales : mockGradeScales,
				reportCardDefinitions: [
					...live.definitions,
					...mockReportCardDefinitions.filter(definition => !liveDefinitionIds.has(definition.id)),
				],
				reportCardResults: [
					...live.results,
					...mockReportCardResults.filter(result => !liveResultIds.has(result.id)),
				],
			};
		},
		{
			gradeScales: mockGradeScales,
			reportCardDefinitions: mockReportCardDefinitions,
			reportCardResults: mockReportCardResults,
		},
	);
}

export async function loadStudent360ForLayout({ hasSession = false }: { hasSession?: boolean }) {
	if (!hasSession) {
		return { healthRecords: mockHealthRecords, pedagogicalNotes: mockPedagogicalNotes };
	}

	return withApiFallback(
		() => loadStudent360Data(),
		{ healthRecords: mockHealthRecords, pedagogicalNotes: mockPedagogicalNotes },
	);
}

export async function loadSchoolLifeForLayout({ hasSession = false }: { hasSession?: boolean }) {
	if (!hasSession) {
		return { incidents, absences };
	}

	return withApiFallback(
		async () => {
			const { incidents: liveIncidents, absences: liveAbsences } = await loadSchoolLifeData();
			return { incidents: liveIncidents, absences: liveAbsences };
		},
		{ incidents, absences },
	);
}

export async function loadSchoolCalendarPage({ url, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);

	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, events: [], classes: classes() };
	}

	const list = hasSession
		? await withApiFallback(() => loadCalendarEvents(), schoolYearEvents)
		: schoolYearEvents;

	const meta = finalizeStatus(url, list.length > 0);
	return { ...meta, events: list, classes: classes() };
}

export async function loadSchoolEventsPage({ url, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);

	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, incidents: [], students: [], classes: classes() };
	}

	if (hasSession) {
		const live = await withApiFallback(
			async () => {
				const [liveIncidents, { students: liveStudents }] = await Promise.all([
					loadIncidents(),
					loadPeopleData(),
				]);
				return { incidents: liveIncidents, students: liveStudents };
			},
			{ incidents, students },
		);
		const meta = finalizeStatus(url, live.incidents.length > 0);
		return { ...meta, ...live, classes: classes() };
	}

	return loadMockSchoolEventsPage({ url });
}

export async function loadClassEvaluationsPage({ url, params, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);

	const classList = classes();
	const classId = params?.classId ?? classList[0]?.id ?? '6a';

	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, classId, evaluations: [] };
	}

	const mockList = evaluations.filter(entry => entry.classId === classId);
	const list = hasSession
		? await withApiFallback(
				() => loadClassEvaluations(classId),
				mockList,
			)
		: mockList;

	const meta = finalizeStatus(url, list.length > 0);
	return { ...meta, classId, evaluations: list };
}

export async function loadRolesPage({ url, hasSession = false }: LoadInput) {
	await maybeSimulateLoading(url);

	if (resolveDemoState(url) === 'empty') {
		const meta = finalizeStatus(url, false);
		return { ...meta, staff: [] };
	}

	if (hasSession) {
		const live = await withApiFallback(
			async () => {
				const [liveStaff, accessRolesData] = await Promise.all([
					getSchoolStaffData(),
					loadAccessRolesData(),
				]);
				return {
					staff: liveStaff,
					...accessRolesData,
				};
			},
			{
				staff,
				accessRoles: [],
				roleCrudMatrix: {},
				roleEnabledPermissions: {},
			},
		);
		const meta = finalizeStatus(url, live.staff.length > 0);
		return { ...meta, ...live };
	}

	return loadMockRolesPage({ url });
}
