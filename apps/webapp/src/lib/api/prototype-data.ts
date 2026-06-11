import type { Activity, Deadline } from '$lib/types/school';
import type { LogEntry } from '$lib/types/teaching-log';
import { browserFetch } from '$lib/api/browser-fetch';

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

interface PrototypeTeachingLogEntry {
	id: string;
	classGroupId: string;
	subjectId: string;
	subjectName: string;
	teacher: string;
	date: string;
	chapter: string;
	content: string;
	objectives: string[];
	homework?: string;
	attachments?: string[];
	progress: number;
}

export function mapTeachingLogEntries(raw: PrototypeTeachingLogEntry[]): LogEntry[] {
	return raw.map(entry => ({
		id: entry.id,
		date: entry.date,
		subject: entry.subjectName,
		teacher: entry.teacher,
		chapter: entry.chapter,
		content: entry.content,
		objectives: entry.objectives,
		homework: entry.homework,
		attachments: entry.attachments,
		progress: entry.progress,
	}));
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

export async function fetchTeachingLogEntries(
	filters?: { classGroupId?: string; subjectName?: string },
): Promise<LogEntry[]> {
	const raw = await browserFetch<PrototypeTeachingLogEntry[]>('/core/prototype/teaching-log/list', {
		method: 'POST',
		body: JSON.stringify(filters ?? {}),
	});
	return mapTeachingLogEntries(raw ?? []);
}

export async function fetchActivities(): Promise<Activity[]> {
	const raw = await browserFetch<PrototypeActivity[]>('/core/prototype/activities/list', {
		method: 'POST',
		body: JSON.stringify({}),
	});
	return mapActivities(raw ?? []);
}

export async function fetchDeadlines(classGroupId?: string): Promise<Deadline[]> {
	const raw = await browserFetch<PrototypeDeadline[]>('/core/prototype/deadlines/list', {
		method: 'POST',
		body: JSON.stringify(classGroupId ? { classGroupId } : {}),
	});
	return mapDeadlines(raw ?? []);
}
