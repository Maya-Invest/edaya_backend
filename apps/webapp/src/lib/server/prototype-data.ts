import type { Activity, Deadline } from '$lib/data/school';
import type { LogEntry } from '$lib/data/teachingLog';
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

interface PrototypeSchoolProfile {
	id: string;
	name: string;
	shortName: string;
	city: string;
	timeZone: string;
}

export function mapSchoolProfiles(raw: PrototypeSchoolProfile[]) {
	return raw.map(school => ({ ...school }));
}

export async function loadSchoolProfiles() {
	const raw = await apiFetch<PrototypeSchoolProfile[]>('/core/prototype/schools/list', {
		method: 'POST',
		body: JSON.stringify({}),
	});
	return mapSchoolProfiles(raw ?? []);
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

export async function loadTeachingLogEntries(filters?: { classGroupId?: string; subjectName?: string }): Promise<LogEntry[]> {
	const raw = await apiFetch<PrototypeTeachingLogEntry[]>('/core/prototype/teaching-log/list', {
		method: 'POST',
		body: JSON.stringify(filters ?? {}),
	});
	return mapTeachingLogEntries(raw ?? []);
}
