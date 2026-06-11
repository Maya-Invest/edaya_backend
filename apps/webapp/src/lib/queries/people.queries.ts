import { academicContext } from '$lib/academic/context.svelte';
import { loadPeopleData } from '$lib/api/people-data';
import { fetchStaffMembers } from '$lib/api/staff-data';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export async function getSchoolStudentsData() {
	const { students } = await loadPeopleData(queryClient());
	return students;
}

export async function getSchoolGuardiansData() {
	const { guardians, students } = await loadPeopleData(queryClient());
	return { guardians, students };
}

export async function getSchoolStaffData() {
	return fetchStaffMembers(queryClient());
}

export function querySchoolStudentsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({
			students: [],
			classes: academicContext.classes,
			hierarchy: academicContext.hierarchy,
		}),
		load: async () => ({
			students: await getSchoolStudentsData(),
			classes: academicContext.classes,
			hierarchy: academicContext.hierarchy,
		}),
		hasItems: data => data.students.length > 0,
	});
}

export function querySchoolGuardiansPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ guardians: [], students: [] }),
		load: async () => getSchoolGuardiansData(),
		hasItems: data => data.guardians.length > 0,
	});
}

export function querySchoolStaffPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ staff: [], guardians: [], students: [] }),
		load: async () => {
			const [staff, { guardians, students }] = await Promise.all([
				getSchoolStaffData(),
				getSchoolGuardiansData(),
			]);
			return { staff, guardians, students };
		},
		hasItems: data => data.staff.length > 0,
	});
}

export function queryClassStudentsPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({
			classId,
			currentClass: academicContext.classes.find(entry => entry.id === classId) ?? academicContext.classes[0],
			students: [],
		}),
		load: async () => {
			const classList = academicContext.classes;
			const currentClass = classList.find(entry => entry.id === classId) ?? classList[0];
			const { students } = await loadPeopleData(queryClient());
			return {
				classId,
				currentClass,
				students: students.filter(student => student.classId === classId),
			};
		},
		hasItems: data => data.students.length > 0,
	});
}
