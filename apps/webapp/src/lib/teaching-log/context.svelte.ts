import type { LogEntry } from '$lib/data/teachingLog';
import { demoTeachingLogEntries, filterEntriesForClass, filterEntriesForSubject } from '$lib/data/teachingLog';

let runtimeEntries: LogEntry[] = [];

export const teachingLogContext = {
	hydrateFromServer(entries: LogEntry[]) {
		runtimeEntries = entries;
	},

	get entries(): LogEntry[] {
		return runtimeEntries;
	},

	forClass(classId: string, subjectNames: string[]): LogEntry[] {
		return runtimeEntries.filter(entry => subjectNames.includes(entry.subject));
	},

	forSubject(subjectName: string): LogEntry[] {
		return runtimeEntries.filter(entry => entry.subject === subjectName);
	},

	resolveClassEntries(classId: string, classSubjects: { name: string }[]): LogEntry[] {
		if (runtimeEntries.length > 0) {
			return this.forClass(classId, classSubjects.map(subject => subject.name));
		}
		return filterEntriesForClass(demoTeachingLogEntries(), classId, classSubjects.map(subject => ({
			classId,
			name: subject.name,
		})));
	},

	resolveSubjectEntries(subjectName: string): LogEntry[] {
		if (runtimeEntries.length > 0) {
			return this.forSubject(subjectName);
		}
		return filterEntriesForSubject(demoTeachingLogEntries(), subjectName);
	},
};

export function getRuntimeTeachingLogEntries(): LogEntry[] {
	return runtimeEntries;
}
