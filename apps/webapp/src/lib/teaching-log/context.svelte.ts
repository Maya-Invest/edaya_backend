import type { LogEntry } from '$lib/data/teachingLog';

let runtimeEntries: LogEntry[] = [];
let ready = false;

export const teachingLogContext = {
	get ready() {
		return ready;
	},

	get entries(): LogEntry[] {
		return runtimeEntries;
	},

	hydrateFromServer(entries: LogEntry[]) {
		runtimeEntries = entries;
		ready = true;
	},

	reset() {
		runtimeEntries = [];
		ready = false;
	},

	forClass(classId: string, subjectNames: string[]): LogEntry[] {
		return runtimeEntries.filter(entry => subjectNames.includes(entry.subject));
	},

	forSubject(subjectName: string): LogEntry[] {
		return runtimeEntries.filter(entry => entry.subject === subjectName);
	},

	resolveClassEntries(classId: string, classSubjects: { name: string }[]): LogEntry[] {
		return this.forClass(classId, classSubjects.map(subject => subject.name));
	},

	resolveSubjectEntries(subjectName: string): LogEntry[] {
		return this.forSubject(subjectName);
	},
};
