import type { StaffRole } from '$lib/data/school';

export const detailHref = {
	schoolStudent: (id: string) => `/school/students/${id}`,
	schoolGuardian: (id: string) => `/school/guardians/${id}`,
	schoolActivity: (id: string) => `/school/activities/${id}`,
	schoolIncident: (id: string) => `/school/events/${id}`,
	schoolCalendarEvent: (id: string) => `/school/calendar/${id}`,
	classStudent: (classId: string, id: string) => `/classes/${classId}/students/${id}`,
	classSubject: (classId: string, id: string) => `/classes/${classId}/subjects/${id}`,
	classPlanning: (classId: string, id: string) => `/classes/${classId}/timetable/${id}`,
	classEvaluation: (classId: string, id: string) => `/classes/${classId}/evaluations/${id}`,
	classTeachingSubject: (classId: string, id: string) => `/classes/${classId}/teaching/${id}`,
	configSubject: (id: string) => `/configuration/subjects/${id}`,
	configSubjectLevel: (label: string) => `/configuration/subjects/level/${encodeURIComponent(label)}`,
	configStaffGuardian: (id: string) => `/configuration/staff/${id}`,
	configStaffMember: (id: string) => `/configuration/staff/${id}`,
	configRole: (role: StaffRole) => `/configuration/roles/${role}`,
	configReportCard: (id: string) => `/configuration/report-cards/${id}`,
	financeBilling: (id: string) => `/finance/billing/${id}`,
	financeFee: (id: string) => `/finance/fees/${id}`,
	classReportCard: (classId: string, id: string) => `/classes/${classId}/report-cards/${id}`
};
