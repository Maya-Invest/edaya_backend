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
import { ApiError } from '$lib/server/api-client';
import { loadPeopleData } from '$lib/server/people-data';
import { loadClassSubjects } from '$lib/server/subjects-data';
import { finalizeStatus, maybeSimulateLoading, resolveDemoState } from './load-state';
import { loadMockAppShell } from './loaders';
import {
	guardians,
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
