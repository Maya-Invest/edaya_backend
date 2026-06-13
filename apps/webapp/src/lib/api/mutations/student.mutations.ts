import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';

type StudentNoteCategory = 'behavior' | 'work' | 'progress' | 'encouragement';
type StudentNoteVisibility = 'staff' | 'admin_only' | 'guardian_visible';
type AttendanceStatus = 'absent' | 'late';
type IncidentKind = 'positive' | 'minor_infraction' | 'major_infraction' | 'emergency';

export async function recordStudentAssessmentResultMutation(input: {
	studentId: string;
	assessmentId: string;
	score: number;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const id = `ar-${input.assessmentId}-${input.studentId}`;
	const result = await runMutation(() => client.commands.recordAssessmentResult({
		id,
		studentId: input.studentId,
		assessmentId: input.assessmentId,
		score: input.score,
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
	return result !== null;
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
	const client = getBrowserSchoolClient();
	const now = new Date().toISOString();
	const incidentId = `inc-${input.studentId}-${Date.now().toString(36)}`;
	const involvementId = `involv-${incidentId}-${input.studentId}`;
	const result = await runMutation(async () => {
		await client.commands.recordIncident({
			id: incidentId,
			schoolId: input.schoolId,
			title: input.title.trim(),
			description: input.description.trim(),
			date: now,
			kind: input.kind,
			classGroupId: input.classGroupId ?? null,
			sessionId: null,
			createdAt: now,
		});
		return client.commands.addStudentInvolvement({
			id: involvementId,
			incidentId,
			studentId: input.studentId,
			role: 'subject',
			notes: null,
			createdAt: now,
		});
	}, { successMessage: input.successMessage });
	return result !== null;
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
	}), { successMessage: input.successMessage });
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
	const result = await runMutation(() => client.commands.createStudentNote({
		id,
		studentId: input.studentId,
		title: input.title ?? null,
		category: input.category,
		body: input.body.trim(),
		visibility: input.visibility ?? 'staff',
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
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
	const result = await runMutation(() => client.commands.updateStudentNote({
		noteId: input.noteId,
		category: input.category,
		body: input.body.trim(),
		visibility: input.visibility ?? 'staff',
		updatedAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
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
	const result = await runMutation(() => client.commands.updateStudentProfile({
		studentId: input.studentId,
		firstName: input.firstName.trim(),
		lastName: input.lastName.trim(),
		birthDate: input.birthDate || null,
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
	const result = await runMutation(() => client.commands.transferStudent({
		enrollmentId: input.enrollmentId,
		nextEnrollmentId,
		nextClassGroupId: input.nextClassGroupId,
		effectiveAt: new Date().toISOString().slice(0, 10),
	}), { successMessage: input.successMessage });
	return result !== null;
}
