import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { LogEntry } from '$lib/types/teaching-log';
import {
	assignmentsForClassSubjects,
	classGroupScope,
	entitiesByIds,
	schoolWideEntityList,
	staffMembersByIds,
	uniqueIds,
} from '$lib/api/entity-list-filters';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

type ClassLogbookEntryRaw = components['schemas']['ClassLogbookEntry'];
type ClassSubjectRaw = components['schemas']['ClassSubject'];
type SubjectRaw = components['schemas']['Subject'];
type StaffMemberRaw = components['schemas']['StaffMember'];
type StaffAssignmentRaw = components['schemas']['StaffAssignment'];

const SCHOOL_TEACHING_LOG_SCOPE
	= 'Teaching log exports without a class scope still load the school-wide logbook catalog.';

export interface TeachingLogSources {
	classLogbookEntriesRaw: ClassLogbookEntryRaw[];
	classSubjectsRaw: ClassSubjectRaw[];
	subjectsRaw: SubjectRaw[];
	staffMembersRaw: StaffMemberRaw[];
	staffAssignmentsRaw: StaffAssignmentRaw[];
}

function formatDate(value: unknown): string {
	if (!value) {
		return '';
	}
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'string') {
		return value.slice(0, 10);
	}
	return String(value).slice(0, 10);
}

function subjectNameForClassSubject(
	classSubjectId: string,
	classSubjectsRaw: ClassSubjectRaw[],
	subjectsRaw: SubjectRaw[],
): string {
	const classSubject = classSubjectsRaw.find(entry => entry.id === classSubjectId);
	if (!classSubject) {
		return 'Unknown subject';
	}

	const subject = subjectsRaw.find(entry => entry.id === classSubject.subjectId);
	return subject?.name ?? 'Unknown subject';
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

export async function fetchTeachingLogSources(client: SchoolClient): Promise<TeachingLogSources> {
	const [
		classLogbookEntriesRaw,
		classSubjectsRaw,
		subjectsRaw,
		staffMembersRaw,
		staffAssignmentsRaw,
	] = await Promise.all([
		client.entities.classLogbookEntries.list(schoolWideEntityList(SCHOOL_TEACHING_LOG_SCOPE)),
		client.entities.classSubjects.list(schoolWideEntityList(SCHOOL_TEACHING_LOG_SCOPE)),
		client.entities.subjects.list(schoolWideEntityList(SCHOOL_TEACHING_LOG_SCOPE)),
		client.entities.staffMembers.list(schoolWideEntityList(SCHOOL_TEACHING_LOG_SCOPE)),
		client.entities.staffAssignments.list(schoolWideEntityList(SCHOOL_TEACHING_LOG_SCOPE)),
	]);

	return {
		classLogbookEntriesRaw: classLogbookEntriesRaw ?? [],
		classSubjectsRaw: classSubjectsRaw ?? [],
		subjectsRaw: subjectsRaw ?? [],
		staffMembersRaw: staffMembersRaw ?? [],
		staffAssignmentsRaw: staffAssignmentsRaw ?? [],
	};
}

export async function fetchClassTeachingLogSources(
	client: SchoolClient,
	classGroupId: string,
): Promise<TeachingLogSources> {
	const [
		classLogbookEntriesRaw,
		classSubjectsRaw,
	] = await Promise.all([
		client.entities.classLogbookEntries.list(classGroupScope(classGroupId)),
		client.entities.classSubjects.list(classGroupScope(classGroupId)),
	]);

	const classSubjectIds = uniqueIds((classSubjectsRaw ?? []).map(classSubject => classSubject.id));
	const subjectIds = uniqueIds((classSubjectsRaw ?? []).map(classSubject => classSubject.subjectId));

	const [
		staffAssignmentsRaw,
		subjectsRaw,
	] = await Promise.all([
		classSubjectIds.length > 0
			? client.entities.staffAssignments.list(assignmentsForClassSubjects(classSubjectIds))
			: Promise.resolve([]),
		subjectIds.length > 0
			? client.entities.subjects.list(entitiesByIds(subjectIds))
			: Promise.resolve([]),
	]);

	const staffIds = uniqueIds((staffAssignmentsRaw ?? []).map(assignment => assignment.staffId));
	const staffMembersRaw = staffIds.length > 0
		? await client.entities.staffMembers.list(staffMembersByIds(staffIds))
		: [];

	return {
		classLogbookEntriesRaw: classLogbookEntriesRaw ?? [],
		classSubjectsRaw: classSubjectsRaw ?? [],
		subjectsRaw: subjectsRaw ?? [],
		staffMembersRaw: staffMembersRaw ?? [],
		staffAssignmentsRaw: staffAssignmentsRaw ?? [],
	};
}

export function mapTeachingLogEntries(
	sources: TeachingLogSources,
	filters?: { classGroupId?: string; subjectName?: string },
): LogEntry[] {
	return sources.classLogbookEntriesRaw
		.filter((entry) => {
			if (filters?.classGroupId && entry.classGroupId !== filters.classGroupId) {
				return false;
			}
			if (filters?.subjectName) {
				const subjectName = subjectNameForClassSubject(
					entry.classSubjectId,
					sources.classSubjectsRaw,
					sources.subjectsRaw,
				);
				if (subjectName !== filters.subjectName) {
					return false;
				}
			}
			return true;
		})
		.map((entry) => {
			const subject = subjectNameForClassSubject(
				entry.classSubjectId,
				sources.classSubjectsRaw,
				sources.subjectsRaw,
			);

			return {
				id: entry.id,
				classId: entry.classGroupId,
				date: formatDate(entry.date),
				subject,
				teacher: teacherNameForClassSubject(
					entry.classSubjectId,
					sources.staffAssignmentsRaw,
					sources.staffMembersRaw,
				),
				chapter: entry.chapter,
				content: entry.content,
				objectives: [...(entry.objectives ?? [])],
				homework: entry.homework ?? undefined,
				attachments: entry.attachments?.length ? [...entry.attachments] : undefined,
				progress: entry.progress,
			} satisfies LogEntry;
		})
		.sort((left, right) => (left.date < right.date ? 1 : -1));
}

export async function fetchTeachingLogEntries(
	filters?: { classGroupId?: string; subjectName?: string },
	client?: SchoolClient,
): Promise<LogEntry[]> {
	const resolvedClient = client ?? (await import('$lib/api/school-client')).getBrowserSchoolClient();
	const sources = filters?.classGroupId
		? await fetchClassTeachingLogSources(resolvedClient, filters.classGroupId)
		: await fetchTeachingLogSources(resolvedClient);
	return mapTeachingLogEntries(sources, filters);
}
