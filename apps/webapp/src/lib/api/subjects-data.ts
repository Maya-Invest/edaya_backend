import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { Subject, SubjectCategory } from '$lib/data/school';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

type SubjectRaw = components['schemas']['Subject'];
type ClassSubjectRaw = components['schemas']['ClassSubject'];
type SubjectMatterRaw = components['schemas']['SubjectMatter'];
type StaffMemberRaw = components['schemas']['StaffMember'];
type StaffAssignmentRaw = components['schemas']['StaffAssignment'];

export interface ClassSubjectsSources {
	classSubjectsRaw: ClassSubjectRaw[];
	subjectsRaw: SubjectRaw[];
	subjectMattersRaw: SubjectMatterRaw[];
	staffMembersRaw: StaffMemberRaw[];
	staffAssignmentsRaw: StaffAssignmentRaw[];
}

const SUBJECT_COLORS: Subject['color'][] = ['mint', 'sky', 'warm'];

function pickColor(seed: string): Subject['color'] {
	let hash = 0;
	for (const char of seed) {
		hash = (hash * 31 + char.charCodeAt(0)) | 0;
	}
	return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length] ?? 'mint';
}

function inferCategory(name: string, code?: string | null): SubjectCategory {
	const label = `${name} ${code ?? ''}`.toLowerCase();

	if (/english|anglais|espagnol|allemand|langue/.test(label)) {
		return 'Langues';
	}
	if (/sport|eps|physique/.test(label) && !/chimie|physics/.test(label)) {
		return 'Sport';
	}
	if (/art|musique|dessin/.test(label)) {
		return 'Arts';
	}
	if (/histoire|géographie|geography|humanities/.test(label)) {
		return 'Sciences humaines';
	}
	if (/français|literature|littér|lettre/.test(label)) {
		return 'Littéraire';
	}

	return 'Scientifique';
}

function teacherNameForClassSubject(
	classSubjectId: string,
	staffAssignmentsRaw: StaffAssignmentRaw[],
	staffMembersRaw: StaffMemberRaw[],
): string {
	const assignment = staffAssignmentsRaw.find(entry => entry.classSubjectId === classSubjectId);
	if (!assignment) {
		return 'Non assigné';
	}

	const teacher = staffMembersRaw.find(member => member.id === assignment.staffId);
	if (!teacher) {
		return 'Non assigné';
	}

	return `${teacher.firstName} ${teacher.lastName}`;
}

function hoursPerWeekForSubject(
	subject: SubjectRaw,
	classSubject: ClassSubjectRaw,
	subjectMattersRaw: SubjectMatterRaw[],
): number {
	const estimatedHours = subjectMattersRaw
		.filter(matter => matter.subjectId === subject.id)
		.reduce((total, matter) => total + (matter.estimatedHours ?? 0), 0);

	if (estimatedHours > 0) {
		return estimatedHours;
	}

	const coefficient = classSubject.coefficient ?? subject.defaultCoefficient;
	if (typeof coefficient === 'number' && coefficient > 0) {
		return Math.max(1, Math.round(coefficient * 2));
	}

	return 3;
}

function descriptionForSubject(
	subject: SubjectRaw,
	subjectMattersRaw: SubjectMatterRaw[],
): string {
	const descriptions = subjectMattersRaw
		.filter(matter => matter.subjectId === subject.id && matter.description)
		.sort((left, right) => left.sequenceOrder - right.sequenceOrder)
		.map(matter => matter.description as string);

	if (descriptions.length > 0) {
		return descriptions.join(' ');
	}

	if (subject.code) {
		return `${subject.name} (${subject.code})`;
	}

	return subject.name;
}

export async function fetchClassSubjectsSources(client: SchoolClient): Promise<ClassSubjectsSources> {
	const [
		classSubjectsRaw,
		subjectsRaw,
		subjectMattersRaw,
		staffMembersRaw,
		staffAssignmentsRaw,
	] = await Promise.all([
		client.entities.classSubjects.list({}),
		client.entities.subjects.list({}),
		client.entities.subjectMatters.list({}),
		client.entities.staffMembers.list({}),
		client.entities.staffAssignments.list({}),
	]);

	return {
		classSubjectsRaw: classSubjectsRaw ?? [],
		subjectsRaw: subjectsRaw ?? [],
		subjectMattersRaw: subjectMattersRaw ?? [],
		staffMembersRaw: staffMembersRaw ?? [],
		staffAssignmentsRaw: staffAssignmentsRaw ?? [],
	};
}

export function mapClassSubjects(
	classGroupId: string,
	sources: ClassSubjectsSources,
): Subject[] {
	const subjectById = new Map(sources.subjectsRaw.map(subject => [subject.id, subject]));

	return sources.classSubjectsRaw
		.filter(classSubject => classSubject.classGroupId === classGroupId)
		.map((classSubject) => {
			const subject = subjectById.get(classSubject.subjectId);
			if (!subject) {
				return null;
			}

			return {
				id: classSubject.id,
				classId: classSubject.classGroupId,
				name: subject.name,
				teacher: teacherNameForClassSubject(
					classSubject.id,
					sources.staffAssignmentsRaw,
					sources.staffMembersRaw,
				),
				hoursPerWeek: hoursPerWeekForSubject(subject, classSubject, sources.subjectMattersRaw),
				color: pickColor(classSubject.id),
				description: descriptionForSubject(subject, sources.subjectMattersRaw),
				category: inferCategory(subject.name, subject.code),
			} satisfies Subject;
		})
		.filter((subject): subject is Subject => subject !== null)
		.sort((left, right) => left.name.localeCompare(right.name, 'fr'));
}

export function mapAllClassSubjects(sources: ClassSubjectsSources): Subject[] {
	const classIds = [...new Set(sources.classSubjectsRaw.map(entry => entry.classGroupId))];
	return classIds.flatMap(classId => mapClassSubjects(classId, sources));
}

export async function loadClassSubjects(client: SchoolClient, classGroupId: string): Promise<Subject[]> {
	const sources = await fetchClassSubjectsSources(client);
	return mapClassSubjects(classGroupId, sources);
}
