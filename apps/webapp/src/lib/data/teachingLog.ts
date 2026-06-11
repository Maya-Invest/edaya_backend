export interface LogEntry {
	id: string;
	date: string;
	subject: string;
	teacher: string;
	chapter: string;
	content: string;
	objectives: string[];
	homework?: string;
	attachments?: string[];
	progress: number;
}

export function filterEntriesForClass(entries: LogEntry[], classId: string, subjects: { classId: string; name: string }[]): LogEntry[] {
	const names = new Set(subjects.filter(subject => subject.classId === classId).map(subject => subject.name));
	return entries.filter(entry => names.has(entry.subject));
}

export function filterEntriesForSubject(entries: LogEntry[], subjectName: string): LogEntry[] {
	return entries.filter(entry => entry.subject === subjectName);
}
