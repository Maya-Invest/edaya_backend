import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { Guardian, Student } from '$lib/types/school';
import {
	activeEnrollmentsForClass,
	assessmentResultsForScope,
	assessmentResultsForStudents,
	assessmentsForClassPeriod,
	attendanceForStudents,
	enrollmentsForStudents,
	guardianLinksForGuardians,
	guardianLinksForStudents,
	guardiansByIds,
	schoolWideEntityList,
	studentsByIds,
	uniqueIds,
} from '$lib/api/entity-list-filters';
import { formatDateInput } from '$lib/date/format';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

const SCHOOL_ROSTER_SCOPE
	= 'School students administration route loads the full school roster intentionally until pagination is added.';

const SCHOOL_GUARDIANS_SCOPE
	= 'School guardians administration lists all guardians; only guardian-linked students and enrollments are fetched by id.';

const SCHOOL_STUDENT_METRICS_SCOPE
	= 'School student list metrics (attendance and grades) still load school-wide until a dedicated aggregate query exists.';

type StudentRaw = components['schemas']['Student'];
type EnrollmentRaw = components['schemas']['StudentClassEnrollment'];
type GuardianRaw = components['schemas']['Guardian'];
type GuardianLinkRaw = components['schemas']['GuardianStudentLink'];
type AttendanceRaw = components['schemas']['Attendance'];
type AssessmentRaw = components['schemas']['Assessment'];
type AssessmentResultRaw = components['schemas']['AssessmentResult'];

export interface PeopleSources {
	studentsRaw: StudentRaw[];
	enrollmentsRaw: EnrollmentRaw[];
	guardiansRaw: GuardianRaw[];
	linksRaw: GuardianLinkRaw[];
}

export interface StudentMetricsSources {
	attendanceRaw: AttendanceRaw[];
	assessmentsRaw: AssessmentRaw[];
	resultsRaw: AssessmentResultRaw[];
}

export interface PeopleData {
	students: Student[];
	guardians: Guardian[];
}

function initialsFor(firstName: string, lastName: string): string {
	return `${firstName[0] ?? ''}${lastName[0] ?? ''}`;
}

function mapGuardianRelation(link: GuardianLinkRaw | undefined): Guardian['relation'] {
	if (!link) {
		return 'Legal guardian';
	}

	const relationship = link.relationship.toLowerCase();
	if (relationship.includes('mother') || relationship.includes('mère')) {
		return 'Mother';
	}
	if (relationship.includes('father') || relationship.includes('père')) {
		return 'Father';
	}
	if (link.legalGuardian) {
		return 'Legal guardian';
	}

	return 'Mother';
}

function mapPreferredContact(guardian: GuardianRaw): Guardian['preferredContact'] {
	const primary = guardian.contactMethods.find(method => method.isPrimary)
		?? guardian.contactMethods[0];

	if (primary?.type === 'sms') {
		return 'sms';
	}
	if (primary?.type === 'phone' || primary?.type === 'whatsapp') {
		return 'phone';
	}
	if (guardian.email || primary?.type === 'email') {
		return 'email';
	}
	if (guardian.phone) {
		return 'phone';
	}

	return 'email';
}

function guardianDisplayName(
	guardian: GuardianRaw | null | undefined,
): string {
	if (!guardian) {
		return 'Non renseigné';
	}

	return `${guardian.firstName} ${guardian.lastName}`;
}

function computeAttendancePercent(studentId: string, attendanceRaw: AttendanceRaw[]): number {
	const records = attendanceRaw.filter(record => record.studentId === studentId);
	if (records.length === 0) {
		return 100;
	}

	const attended = records.filter(record => record.status === 'present' || record.status === 'late').length;
	return Math.round((attended / records.length) * 1000) / 10;
}

function computeStudentAverage(
	studentId: string,
	resultsRaw: AssessmentResultRaw[],
	assessmentsById: Map<string, AssessmentRaw>,
): number {
	let weightedSum = 0;
	let totalCoefficient = 0;

	for (const result of resultsRaw) {
		if (result.studentId !== studentId || typeof result.score !== 'number') {
			continue;
		}

		const assessment = assessmentsById.get(result.assessmentId);
		if (!assessment) {
			continue;
		}

		const coefficient = assessment.coefficient ?? 1;
		const maxScore = assessment.maxScore > 0 ? assessment.maxScore : 20;
		const normalized = (result.score / maxScore) * 20;
		weightedSum += normalized * coefficient;
		totalCoefficient += coefficient;
	}

	if (totalCoefficient === 0) {
		return 0;
	}

	return Math.round((weightedSum / totalCoefficient) * 10) / 10;
}

function mapStudentStatus(
	status: StudentRaw['status'],
	average: number,
): Student['status'] {
	if (status === 'inactive' || status === 'archived') {
		return 'warning';
	}
	if (average >= 16) {
		return 'honor';
	}
	if (average > 0 && average < 10) {
		return 'warning';
	}
	return 'active';
}

export async function fetchPeopleSources(client: SchoolClient): Promise<PeopleSources> {
	const [
		studentsRaw,
		enrollmentsRaw,
		guardiansRaw,
		linksRaw,
	] = await Promise.all([
		client.entities.students.list(schoolWideEntityList(SCHOOL_ROSTER_SCOPE)),
		client.entities.enrollments.list(schoolWideEntityList(SCHOOL_ROSTER_SCOPE)),
		client.entities.guardians.list(schoolWideEntityList(SCHOOL_ROSTER_SCOPE)),
		client.entities.guardianLinks.list(schoolWideEntityList(SCHOOL_ROSTER_SCOPE)),
	]);

	return {
		studentsRaw: studentsRaw ?? [],
		enrollmentsRaw: enrollmentsRaw ?? [],
		guardiansRaw: guardiansRaw ?? [],
		linksRaw: linksRaw ?? [],
	};
}

export async function fetchGuardiansPeopleSources(client: SchoolClient): Promise<PeopleSources> {
	const guardiansRaw = (await client.entities.guardians.list(
		schoolWideEntityList(SCHOOL_GUARDIANS_SCOPE),
	)) ?? [];
	const guardianIds = uniqueIds(guardiansRaw.map(guardian => guardian.id));

	if (guardianIds.length === 0) {
		return {
			studentsRaw: [],
			enrollmentsRaw: [],
			guardiansRaw,
			linksRaw: [],
		};
	}

	const linksRaw = (await client.entities.guardianLinks.list(
		guardianLinksForGuardians(guardianIds),
	)) ?? [];
	const studentIds = uniqueIds(linksRaw.map(link => link.studentId));

	if (studentIds.length === 0) {
		return {
			studentsRaw: [],
			enrollmentsRaw: [],
			guardiansRaw,
			linksRaw,
		};
	}

	const [
		studentsRaw,
		enrollmentsRaw,
	] = await Promise.all([
		client.entities.students.list(studentsByIds(studentIds)),
		client.entities.enrollments.list(enrollmentsForStudents(studentIds)),
	]);

	return {
		studentsRaw: studentsRaw ?? [],
		enrollmentsRaw: enrollmentsRaw ?? [],
		guardiansRaw,
		linksRaw,
	};
}

export async function fetchClassPeopleSources(
	client: SchoolClient,
	classGroupId: string,
): Promise<PeopleSources> {
	const enrollmentsRaw = (await client.entities.enrollments.list(
		activeEnrollmentsForClass(classGroupId),
	)) ?? [];
	const studentIds = uniqueIds(enrollmentsRaw.map(enrollment => enrollment.studentId));

	if (studentIds.length === 0) {
		return {
			studentsRaw: [],
			enrollmentsRaw,
			guardiansRaw: [],
			linksRaw: [],
		};
	}

	const [
		studentsRaw,
		linksRaw,
	] = await Promise.all([
		client.entities.students.list(studentsByIds(studentIds)),
		client.entities.guardianLinks.list(guardianLinksForStudents(studentIds)),
	]);

	const guardianIds = uniqueIds((linksRaw ?? []).map(link => link.guardianId));
	const guardiansRaw = guardianIds.length > 0
		? await client.entities.guardians.list(guardiansByIds(guardianIds))
		: [];

	return {
		studentsRaw: studentsRaw ?? [],
		enrollmentsRaw,
		guardiansRaw: guardiansRaw ?? [],
		linksRaw: linksRaw ?? [],
	};
}

async function fetchStudentMetricsSources(
	client: SchoolClient,
	studentIds: readonly string[],
	classScope?: { classGroupId: string; periodId: string },
): Promise<StudentMetricsSources> {
	if (studentIds.length === 0) {
		return {
			attendanceRaw: [],
			assessmentsRaw: [],
			resultsRaw: [],
		};
	}

	const [attendanceRaw, assessmentsRaw] = await Promise.all([
		client.entities.attendance.list(attendanceForStudents(studentIds)),
		classScope
			? client.entities.assessments.list(
					assessmentsForClassPeriod(classScope.classGroupId, classScope.periodId),
				)
			: client.entities.assessments.list(schoolWideEntityList(SCHOOL_STUDENT_METRICS_SCOPE)),
	]);
	const assessmentIds = uniqueIds((assessmentsRaw ?? []).map(assessment => assessment.id));
	const resultsRaw = classScope
		? assessmentIds.length > 0
			? await client.entities.assessmentResults.list(
					assessmentResultsForScope(assessmentIds, studentIds),
				)
			: []
		: await client.entities.assessmentResults.list(assessmentResultsForStudents(studentIds));

	return {
		attendanceRaw: attendanceRaw ?? [],
		assessmentsRaw: assessmentsRaw ?? [],
		resultsRaw: resultsRaw ?? [],
	};
}

export function mapPeopleData(
	sources: PeopleSources,
	metrics: StudentMetricsSources = {
		attendanceRaw: [],
		assessmentsRaw: [],
		resultsRaw: [],
	},
): PeopleData {
	const guardians = mapGuardians(sources.guardiansRaw, sources.linksRaw);
	const students = mapStudents(sources, metrics);

	return { students, guardians };
}

export function mapStudents(
	sources: PeopleSources,
	metrics: StudentMetricsSources = {
		attendanceRaw: [],
		assessmentsRaw: [],
		resultsRaw: [],
	},
): Student[] {
	const { studentsRaw, enrollmentsRaw, guardiansRaw, linksRaw } = sources;
	const assessmentsById = new Map(metrics.assessmentsRaw.map(assessment => [assessment.id, assessment]));

	return studentsRaw.map((student) => {
		const activeEnrollment = enrollmentsRaw.find(
			enrollment => enrollment.studentId === student.id && enrollment.status === 'active',
		);
		const classId = activeEnrollment?.classGroupId ?? '';
		const link = linksRaw.find(entry => entry.studentId === student.id);
		const guardian = link
			? guardiansRaw.find(entry => entry.id === link.guardianId)
			: null;
		const average = computeStudentAverage(student.id, metrics.resultsRaw, assessmentsById);

		return {
			id: student.id,
			classId,
			enrollmentId: activeEnrollment?.id,
			name: `${student.firstName} ${student.lastName}`,
			initials: initialsFor(student.firstName, student.lastName),
			email: `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}@school.edu`,
			birthdate: formatDateInput(student.birthDate),
			guardian: guardianDisplayName(guardian),
			attendance: computeAttendancePercent(student.id, metrics.attendanceRaw),
			average,
			status: mapStudentStatus(student.status, average),
		};
	});
}

export function mapGuardians(
	guardiansRaw: GuardianRaw[],
	linksRaw: GuardianLinkRaw[],
): Guardian[] {
	return guardiansRaw.map((guardian) => {
		const guardianLinks = linksRaw.filter(link => link.guardianId === guardian.id);
		const primaryLink = guardianLinks.find(link => link.isPrimary) ?? guardianLinks[0];
		const email = guardian.email
			?? guardian.contactMethods.find(method => method.type === 'email')?.value
			?? '';
		const phone = guardian.phone
			?? guardian.contactMethods.find(method => method.type === 'phone' || method.type === 'whatsapp')?.value
			?? '';

		return {
			id: guardian.id,
			name: `${guardian.firstName} ${guardian.lastName}`,
			initials: initialsFor(guardian.firstName, guardian.lastName),
			relation: mapGuardianRelation(primaryLink),
			email,
			phone,
			studentIds: guardianLinks.map(link => link.studentId),
			preferredContact: mapPreferredContact(guardian),
		};
	});
}

export async function loadPeopleData(client: SchoolClient): Promise<PeopleData> {
	const sources = await fetchPeopleSources(client);
	const studentIds = uniqueIds(sources.studentsRaw.map(student => student.id));
	const metrics = await fetchStudentMetricsSources(client, studentIds);
	return mapPeopleData(sources, metrics);
}

export async function loadGuardiansPeopleData(client: SchoolClient): Promise<PeopleData> {
	const sources = await fetchGuardiansPeopleSources(client);
	return mapPeopleData(sources);
}

export async function loadClassPeopleData(
	client: SchoolClient,
	classGroupId: string,
	periodId: string,
): Promise<PeopleData> {
	const sources = await fetchClassPeopleSources(client, classGroupId);
	const studentIds = uniqueIds(sources.studentsRaw.map(student => student.id));
	const metrics = await fetchStudentMetricsSources(client, studentIds, { classGroupId, periodId });
	return mapPeopleData(sources, metrics);
}
