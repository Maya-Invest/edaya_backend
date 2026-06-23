import { academicContext } from '$lib/academic/context.svelte';
import { loadClassPeopleData, loadGuardiansPeopleData, loadPeopleData } from '$lib/api/people-data';
import { fetchStaffMembers } from '$lib/api/staff-data';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';
import { getStudent360Data, studentDetailIdFromUrl } from '$lib/queries/student-360.queries';

async function seedStudent360ForUrl(url: URL) {
	const studentId = studentDetailIdFromUrl(url);
	if (!studentId) {
		return;
	}

	const { healthRecord, pedagogicalNotes } = await getStudent360Data(studentId);
	detailDataContext.seedStudent360Data(studentId, healthRecord, pedagogicalNotes);
}

export async function getSchoolStudentsData() {
	const { students } = await loadPeopleData(queryClient());
	return students;
}

export async function getSchoolGuardiansData() {
	const { guardians, students } = await loadGuardiansPeopleData(queryClient());
	return { guardians, students };
}

export async function getSchoolStaffData() {
	return fetchStaffMembers(queryClient(), {
		schoolId: academicContext.schools[0]?.id ?? '',
		academicYearId: academicContext.yearId,
	});
}

export function querySchoolStudentsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			const students = await getSchoolStudentsData();
			detailDataContext.seedStudents(students);
			await seedStudent360ForUrl(url);
			return {};
		},
		hasItems: () => detailDataContext.students.length > 0,
	});
}

export function querySchoolGuardiansPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			const { guardians, students } = await getSchoolGuardiansData();
			detailDataContext.seedGuardians(guardians);
			detailDataContext.seedStudents(students);
			return {};
		},
		hasItems: () => detailDataContext.guardians.length > 0,
	});
}

export function querySchoolStaffPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			const staff = await getSchoolStaffData();
			detailDataContext.seedStaff(staff);
			return {};
		},
		hasItems: () => detailDataContext.staff.length > 0,
	});
}

export function queryClassStudentsPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({
			classId,
			currentClass: academicContext.classes.find(entry => entry.id === classId) ?? academicContext.classes[0],
		}),
		load: async () => {
			const classList = academicContext.classes;
			const currentClass = classList.find(entry => entry.id === classId) ?? classList[0];
			const { students } = await loadClassPeopleData(
				queryClient(),
				classId,
				academicContext.periodId,
			);
			detailDataContext.seedStudents(students, { classId });
			await seedStudent360ForUrl(url);
			return { classId, currentClass };
		},
		hasItems: () => detailDataContext.studentsForClass(classId).length > 0,
	});
}
