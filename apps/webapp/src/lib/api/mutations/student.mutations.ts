import type { PedagogicalNote } from '$lib/types/school';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { dateInputToIso } from '$lib/date/format';
import { recordAssessmentResultMutation } from '$lib/api/mutations/evaluation.mutations';
import { recordIncidentMutation } from '$lib/api/mutations/incident.mutations';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { authSession } from '$lib/auth/session.svelte';

type StudentNoteCategory = 'behavior' | 'work' | 'progress' | 'encouragement';
type StudentNoteVisibility = 'staff' | 'admin_only' | 'guardian_visible';
type AttendanceStatus = 'absent' | 'late';
type IncidentKind = 'positive' | 'minor_infraction' | 'major_infraction' | 'emergency';

const NOTE_CATEGORY_LABEL: Record<StudentNoteCategory, PedagogicalNote['category']> = {
	behavior: 'Comportement',
	work: 'Travail',
	progress: 'Progression',
	encouragement: 'Encouragement',
};
function schoolId(): string {
	return authSession.schoolId ?? academicContext.schools[0]?.id ?? '';
}

export async function createStudentMutation(input: {
	firstName: string;
	lastName: string;
	classGroupId: string;
	birthDate?: string;
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const resolvedSchoolId = schoolId();
	if (!resolvedSchoolId)
		return null;

	const studentId = `stu-${Date.now().toString(36)}`;
	const enrollmentId = `enr-${studentId}`;
	const now = new Date().toISOString();
	const birthDate = dateInputToIso(input.birthDate ?? '');

	const result = await runMutation(async () => {
		await client.commands.registerStudent({
			id: studentId,
			schoolId: resolvedSchoolId,
			firstName: input.firstName.trim(),
			lastName: input.lastName.trim(),
			birthDate,
			createdAt: now,
		});
		return client.commands.enrollStudent({
			id: enrollmentId,
			studentId,
			classGroupId: input.classGroupId,
			createdAt: now,
		});
	}, { successMessage: input.successMessage });

	return result ? studentId : null;
}

export async function recordStudentAssessmentResultMutation(input: {
	studentId: string;
	assessmentId: string;
	score: number;
	successMessage?: string;
}): Promise<boolean> {
	return recordAssessmentResultMutation(input);
}

export async function recordStudentDailyAttendanceMutation(input: {
	studentId: string;
	classGroupId: string;
	date: string;
	status: AttendanceStatus;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const id = `att-${input.studentId}-${input.date}`;
	const result = await runMutation(() => client.commands.recordDailyAttendance({
		id,
		studentId: input.studentId,
		classGroupId: input.classGroupId,
		date: input.date,
		status: input.status,
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
	return result !== null;
}

export async function recordStudentIncidentMutation(input: {
	schoolId: string;
	studentId: string;
	classGroupId?: string;
	title: string;
	description: string;
	kind: IncidentKind;
	successMessage?: string;
}): Promise<boolean> {
	const incidentId = await recordIncidentMutation(input);
	return incidentId !== null;
}

export async function linkGuardianToStudentMutation(input: {
	guardianId: string;
	studentId: string;
	relationship?: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const id = `gl-${input.guardianId}-${input.studentId}`;

	const result = await runMutation(() => client.commands.linkGuardianToStudent({
		id,
		guardianId: input.guardianId,
		studentId: input.studentId,
		relationship: input.relationship ?? 'parent',
		isPrimary: false,
		isBillingContact: false,
		legalGuardian: false,
		canPickup: false,
		emergencyContactPriority: null,
		receivesAcademicReports: true,
		receivesAttendanceAlerts: true,
		contactRestrictions: null,
		notes: null,
		createdAt: new Date().toISOString(),
	}), {
		apply: () => {
			const guardian = detailDataContext.guardians.find(entry => entry.id === input.guardianId);
			if (guardian && !guardian.studentIds.includes(input.studentId)) {
				detailDataContext.patchGuardian(input.guardianId, {
					studentIds: [...guardian.studentIds, input.studentId],
				});
			}
		},
		successMessage: input.successMessage,
	});
	return result !== null;
}

export async function createStudentNoteMutation(input: {
	studentId: string;
	title?: string | null;
	category: StudentNoteCategory;
	body: string;
	visibility?: StudentNoteVisibility;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const id = `note-${input.studentId}-${Date.now().toString(36)}`;
	const optimisticNote: PedagogicalNote = {
		id,
		studentId: input.studentId,
		date: new Date().toISOString().slice(0, 10),
		authorId: 'staff-self',
		category: NOTE_CATEGORY_LABEL[input.category],
		content: input.body.trim(),
	};

	const result = await runMutation(() => client.commands.createStudentNote({
		id,
		studentId: input.studentId,
		title: input.title ?? null,
		category: input.category,
		body: input.body.trim(),
		visibility: input.visibility ?? 'staff',
		createdAt: new Date().toISOString(),
	}), {
		apply: () => detailDataContext.appendPedagogicalNote(optimisticNote),
		rollback: () => {
			detailDataContext.pedagogicalNotes = detailDataContext.pedagogicalNotes.filter(
				note => note.id !== id,
			);
		},
		successMessage: input.successMessage,
	});
	return result !== null;
}

export async function updateStudentNoteMutation(input: {
	noteId: string;
	category: StudentNoteCategory;
	body: string;
	visibility?: StudentNoteVisibility;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const previous = detailDataContext.pedagogicalNotes.find(note => note.id === input.noteId);
	const patch = {
		category: NOTE_CATEGORY_LABEL[input.category],
		content: input.body.trim(),
	};

	const result = await runMutation(() => client.commands.updateStudentNote({
		noteId: input.noteId,
		category: input.category,
		body: input.body.trim(),
		visibility: input.visibility ?? 'staff',
		updatedAt: new Date().toISOString(),
	}), {
		apply: () => detailDataContext.patchPedagogicalNote(input.noteId, patch),
		rollback: () => {
			if (previous) {
				detailDataContext.patchPedagogicalNote(input.noteId, {
					category: previous.category,
					content: previous.content,
				});
			}
		},
		successMessage: input.successMessage,
	});
	return result !== null;
}

export async function updateStudentProfileMutation(input: {
	studentId: string;
	firstName: string;
	lastName: string;
	birthDate?: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const previous = detailDataContext.students.find(student => student.id === input.studentId);
	const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
	const patch = {
		name: fullName,
		birthdate: input.birthDate ?? previous?.birthdate ?? '',
	};

	const result = await runMutation(() => client.commands.updateStudentProfile({
		studentId: input.studentId,
		firstName: input.firstName.trim(),
		lastName: input.lastName.trim(),
		birthDate: input.birthDate || null,
	}), {
		apply: () => detailDataContext.patchStudent(input.studentId, patch),
		rollback: () => {
			if (previous) {
				detailDataContext.patchStudent(input.studentId, {
					name: previous.name,
					birthdate: previous.birthdate,
				});
			}
		},
		successMessage: input.successMessage,
	});
	birthDate: dateInputToIso(input.birthDate ?? '') ?? null,
	}), { successMessage: input.successMessage });
return result !== null;
}

export async function transferStudentMutation(input: {
	enrollmentId: string;
	studentId: string;
	nextClassGroupId: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const nextEnrollmentId = `enr-${input.studentId}-${Date.now().toString(36)}`;
	const previousClassId = detailDataContext.students.find(student => student.id === input.studentId)?.classId;

	const result = await runMutation(() => client.commands.transferStudent({
		enrollmentId: input.enrollmentId,
		nextEnrollmentId,
		nextClassGroupId: input.nextClassGroupId,
		effectiveAt: new Date().toISOString().slice(0, 10),
	}), {
		apply: () => detailDataContext.patchStudent(input.studentId, { classId: input.nextClassGroupId }),
		rollback: () => {
			if (previousClassId) {
				detailDataContext.patchStudent(input.studentId, { classId: previousClassId });
			}
		},
		successMessage: input.successMessage,
	});
	return result !== null;
}
