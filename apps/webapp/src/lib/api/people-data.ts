import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { Guardian, Student } from '$lib/types/school';
import { formatDateInput } from '$lib/date/format';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

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
		client.entities.students.list({}),
		client.entities.enrollments.list({}),
		client.entities.guardians.list({}),
		client.entities.guardianLinks.list({}),
	]);

	return {
		studentsRaw: studentsRaw ?? [],
		enrollmentsRaw: enrollmentsRaw ?? [],
		guardiansRaw: guardiansRaw ?? [],
		linksRaw: linksRaw ?? [],
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
	const [
		sources,
		attendanceRaw,
		assessmentsRaw,
		resultsRaw,
	] = await Promise.all([
		fetchPeopleSources(client),
		client.entities.attendance.list({}),
		client.entities.assessments.list({}),
		client.entities.assessmentResults.list({}),
	]);

	return mapPeopleData(sources, {
		attendanceRaw: attendanceRaw ?? [],
		assessmentsRaw: assessmentsRaw ?? [],
		resultsRaw: resultsRaw ?? [],
	});
}
