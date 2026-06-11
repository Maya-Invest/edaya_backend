import { query } from '$app/server';
import { loadPeopleData } from '$lib/server/people-data';
import { fetchStaffMembers } from '$lib/server/staff-data';

export const getSchoolStudentsData = query(async () => {
	const { students } = await loadPeopleData();
	return students;
});

export const getSchoolGuardiansData = query(async () => {
	const { guardians, students } = await loadPeopleData();
	return { guardians, students };
});

export const getSchoolStaffData = query(async () => fetchStaffMembers());
