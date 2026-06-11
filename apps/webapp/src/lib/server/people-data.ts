import type { components } from '$lib/api/schema';
import type { Guardian, Student } from '$lib/data/school';
import { getSchoolClient } from '$lib/server/school-client';

type StudentRaw = components['schemas']['Student'];
type EnrollmentRaw = components['schemas']['StudentClassEnrollment'];
type GuardianRaw = components['schemas']['Guardian'];
type GuardianLinkRaw = components['schemas']['GuardianStudentLink'];

export interface PeopleSources {
	studentsRaw: StudentRaw[];
	enrollmentsRaw: EnrollmentRaw[];
	guardiansRaw: GuardianRaw[];
	linksRaw: GuardianLinkRaw[];
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

export async function fetchPeopleSources(): Promise<PeopleSources> {
	const client = getSchoolClient();
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

export function mapPeopleData(sources: PeopleSources): PeopleData {
	const guardians = mapGuardians(sources.guardiansRaw, sources.linksRaw);
	const students = mapStudents(sources);

	return { students, guardians };
}

export function mapStudents(sources: PeopleSources): Student[] {
	const { studentsRaw, enrollmentsRaw, guardiansRaw, linksRaw } = sources;

	return studentsRaw.map((student) => {
		const activeEnrollment = enrollmentsRaw.find(
			enrollment => enrollment.studentId === student.id && enrollment.status === 'active',
		);
		const classId = activeEnrollment?.classGroupId ?? '';
		const link = linksRaw.find(entry => entry.studentId === student.id);
		const guardian = link
			? guardiansRaw.find(entry => entry.id === link.guardianId)
			: null;

		return {
			id: student.id,
			classId,
			name: `${student.firstName} ${student.lastName}`,
			initials: initialsFor(student.firstName, student.lastName),
			email: `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}@school.edu`,
			birthdate: typeof student.birthDate === 'string'
				? student.birthDate
				: String(student.birthDate || ''),
			guardian: guardianDisplayName(guardian),
			attendance: 98,
			average: 14.5,
			status: 'active',
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

export async function loadPeopleData(): Promise<PeopleData> {
	return mapPeopleData(await fetchPeopleSources());
}
