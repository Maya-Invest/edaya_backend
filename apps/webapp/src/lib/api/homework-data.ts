import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { Deadline } from '$lib/types/school';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

type HomeworkAssignmentRaw = components['schemas']['HomeworkAssignment'];
type HomeworkSubmissionRaw = components['schemas']['HomeworkSubmission'];
type ClassSubjectRaw = components['schemas']['ClassSubject'];
type SubjectRaw = components['schemas']['Subject'];

export interface HomeworkSources {
	homeworkAssignmentsRaw: HomeworkAssignmentRaw[];
	homeworkSubmissionsRaw: HomeworkSubmissionRaw[];
	classSubjectsRaw: ClassSubjectRaw[];
	subjectsRaw: SubjectRaw[];
}

const TYPE_TO_UI: Record<string, Deadline['type']> = {
	homework: 'Homework',
	project: 'Project',
	reading: 'Reading',
	lab: 'Lab',
};

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

export async function fetchHomeworkSources(client: SchoolClient): Promise<HomeworkSources> {
	const [
		homeworkAssignmentsRaw,
		homeworkSubmissionsRaw,
		classSubjectsRaw,
		subjectsRaw,
	] = await Promise.all([
		client.entities.homeworkAssignments.list({}),
		client.entities.homeworkSubmissions.list({}),
		client.entities.classSubjects.list({}),
		client.entities.subjects.list({}),
	]);

	return {
		homeworkAssignmentsRaw: homeworkAssignmentsRaw ?? [],
		homeworkSubmissionsRaw: homeworkSubmissionsRaw ?? [],
		classSubjectsRaw: classSubjectsRaw ?? [],
		subjectsRaw: subjectsRaw ?? [],
	};
}

export function mapDeadlines(
	classGroupId: string | undefined,
	sources: HomeworkSources,
): Deadline[] {
	const submissionsByAssignment = new Map<string, HomeworkSubmissionRaw[]>();
	for (const submission of sources.homeworkSubmissionsRaw) {
		const current = submissionsByAssignment.get(submission.homeworkAssignmentId) ?? [];
		current.push(submission);
		submissionsByAssignment.set(submission.homeworkAssignmentId, current);
	}

	return sources.homeworkAssignmentsRaw
		.filter(assignment => !classGroupId || assignment.classGroupId === classGroupId)
		.map((assignment) => {
			const submissions = submissionsByAssignment.get(assignment.id) ?? [];

			return {
				id: assignment.id,
				classId: assignment.classGroupId,
				title: assignment.title,
				subject: subjectNameForClassSubject(
					assignment.classSubjectId,
					sources.classSubjectsRaw,
					sources.subjectsRaw,
				),
				description: assignment.description,
				dueDate: formatDate(assignment.dueDate),
				assignedDate: formatDate(assignment.assignedDate),
				type: TYPE_TO_UI[assignment.type] ?? 'Homework',
				attachments: (assignment.attachments ?? []).map(attachment => ({
					name: attachment.name,
					size: attachment.size,
				})),
				submissions: submissions.map(submission => ({
					studentId: submission.studentId,
					status: submission.status as Deadline['submissions'][number]['status'],
					date: submission.submittedAt ? formatDate(submission.submittedAt) : undefined,
				})),
			} satisfies Deadline;
		})
		.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export async function fetchDeadlines(classGroupId?: string, client?: SchoolClient): Promise<Deadline[]> {
	const resolvedClient = client ?? (await import('$lib/api/school-client')).getBrowserSchoolClient();
	const sources = await fetchHomeworkSources(resolvedClient);
	return mapDeadlines(classGroupId, sources);
}
