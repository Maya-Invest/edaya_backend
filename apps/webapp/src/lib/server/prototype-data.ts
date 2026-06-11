import type { Activity, Deadline } from '$lib/data/school';
import { apiFetch } from '$lib/server/api-client';

interface PrototypeActivity {
	id: string;
	name: string;
	category: Activity['category'];
	coach: string;
	schedule: string;
	participants: number;
	capacity: number;
	description: string;
	startDate: string;
	endDate: string;
	enrollments: Activity['enrollments'];
}

interface PrototypeDeadline {
	id: string;
	classGroupId: string;
	title: string;
	subject: string;
	description: string;
	dueDate: string;
	assignedDate: string;
	type: Deadline['type'];
	attachments: Deadline['attachments'];
	submissions: Deadline['submissions'];
}

export function mapActivities(raw: PrototypeActivity[]): Activity[] {
	return raw.map(activity => ({ ...activity }));
}

export function mapDeadlines(raw: PrototypeDeadline[]): Deadline[] {
	return raw.map(deadline => ({
		id: deadline.id,
		classId: deadline.classGroupId,
		title: deadline.title,
		subject: deadline.subject,
		description: deadline.description,
		dueDate: deadline.dueDate,
		assignedDate: deadline.assignedDate,
		type: deadline.type,
		attachments: deadline.attachments,
		submissions: deadline.submissions,
	}));
}

export async function loadActivities(): Promise<Activity[]> {
	const raw = await apiFetch<PrototypeActivity[]>('/core/prototype/activities/list', {
		method: 'POST',
		body: JSON.stringify({}),
	});
	return mapActivities(raw ?? []);
}

export async function loadDeadlines(classGroupId?: string): Promise<Deadline[]> {
	const raw = await apiFetch<PrototypeDeadline[]>('/core/prototype/deadlines/list', {
		method: 'POST',
		body: JSON.stringify(classGroupId ? { classGroupId } : {}),
	});
	return mapDeadlines(raw ?? []);
}
