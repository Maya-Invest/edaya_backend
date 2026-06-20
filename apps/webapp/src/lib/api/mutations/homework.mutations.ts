import type { components } from '$lib/api/schema';
import type { Deadline } from '$lib/types/school';
import { authSession } from '$lib/auth/session.svelte';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { toast } from '$lib/toast.svelte';
import { get } from 'svelte/store';
import { t } from '$lib/i18n';

type ApiHomeworkAssignment = components['schemas']['HomeworkAssignment'];

const UI_TO_API_TYPE: Record<Deadline['type'], ApiHomeworkAssignment['type']> = {
	Homework: 'homework',
	Project: 'project',
	Reading: 'reading',
	Lab: 'lab',
};

export async function createHomeworkMutation(input: {
	classGroupId: string;
	classSubjectId: string;
	title: string;
	description: string;
	dueDate: string;
	assignedDate: string;
	type: Deadline['type'];
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const schoolId = authSession.schoolId;
	if (!schoolId) {
		toast.error(get(t)('hw.noContext'));
		return null;
	}

	const id = `hw-${Date.now().toString(36)}`;
	const result = await runMutation(() => client.entities.homeworkAssignments.save({
		id,
		schoolId,
		classGroupId: input.classGroupId,
		classSubjectId: input.classSubjectId,
		title: input.title.trim(),
		description: input.description.trim(),
		dueDate: input.dueDate,
		assignedDate: input.assignedDate,
		type: UI_TO_API_TYPE[input.type],
		attachments: [],
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
	return result ? id : null;
}

export async function updateHomeworkMutation(input: {
	assignmentId: string;
	title: string;
	description: string;
	dueDate: string;
	assignedDate: string;
	type: Deadline['type'];
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const result = await runMutation(async () => {
		const existing = await client.entities.homeworkAssignments.get(input.assignmentId);
		const payload: ApiHomeworkAssignment = {
			...existing,
			title: input.title.trim(),
			description: input.description.trim(),
			dueDate: input.dueDate,
			assignedDate: input.assignedDate,
			type: UI_TO_API_TYPE[input.type],
		};
		return client.entities.homeworkAssignments.save(payload);
	}, { successMessage: input.successMessage });
	return result !== null;
}
