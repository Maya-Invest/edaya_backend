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

/** Demo-mode teaching journal types and minimal offline fallback. Canonical data: `@edaya/dev-fixtures` → `SEED_TEACHING_LOG_ENTRIES`. */
const DEMO_ENTRIES: LogEntry[] = [
	{
		id: 'demo-1',
		date: '2026-05-20',
		subject: 'Mathematics',
		teacher: 'Mme Dupont',
		chapter: 'Ch. 6 — Fractions',
		content: 'Addition et soustraction de fractions à dénominateurs différents.',
		objectives: ['Mettre au même dénominateur'],
		progress: 62,
	},
];

export function filterEntriesForClass(entries: LogEntry[], classId: string, subjects: { classId: string; name: string }[]): LogEntry[] {
	const names = new Set(subjects.filter(subject => subject.classId === classId).map(subject => subject.name));
	return entries.filter(entry => names.has(entry.subject));
}

export function filterEntriesForSubject(entries: LogEntry[], subjectName: string): LogEntry[] {
	return entries.filter(entry => entry.subject === subjectName);
}

export function demoTeachingLogEntries(): LogEntry[] {
	return DEMO_ENTRIES;
}
