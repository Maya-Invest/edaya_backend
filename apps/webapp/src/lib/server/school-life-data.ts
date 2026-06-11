import type { components } from '$lib/api/schema';
import type { AbsenceRecord, Incident, SchoolYearEvent } from '$lib/data/school';
import { getSchoolClient } from '$lib/server/school-client';

type CalendarEventRaw = components['schemas']['CalendarEvent'];
type IncidentRaw = components['schemas']['Incident'];
type InvolvementRaw = components['schemas']['StudentIncidentInvolvement'];
type AttendanceRaw = components['schemas']['Attendance'];
type SessionRaw = components['schemas']['Session'];
type ClassSubjectRaw = components['schemas']['ClassSubject'];
type SubjectRaw = components['schemas']['Subject'];

export interface SchoolLifeSources {
	calendarEventsRaw: CalendarEventRaw[];
	incidentsRaw: IncidentRaw[];
	involvementsRaw: InvolvementRaw[];
	attendanceRaw: AttendanceRaw[];
	sessionsRaw: SessionRaw[];
	classSubjectsRaw: ClassSubjectRaw[];
	subjectsRaw: SubjectRaw[];
}

const INCIDENT_UI_META: Record<string, { category: Incident['category']; severity: Incident['severity'] }> = {
	i1: { category: 'Tardiness', severity: 'low' },
	i2: { category: 'Behavior', severity: 'medium' },
	i3: { category: 'Conflict', severity: 'medium' },
};

const CALENDAR_KIND_TO_TYPE: Record<string, SchoolYearEvent['type']> = {
	holiday: 'holiday',
	break: 'vacation',
	other: 'closure',
	event: 'ceremony',
};

function formatDate(value: unknown): string {
	if (!value) {
		return '';
	}
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'string') {
		return value.slice(0, 10);
	}
	return String(value).slice(0, 10);
}

function formatTime(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	const hours = `${date.getUTCHours()}`.padStart(2, '0');
	const minutes = `${date.getUTCMinutes()}`.padStart(2, '0');
	return `${hours}:${minutes}`;
}

export async function fetchSchoolLifeSources(): Promise<SchoolLifeSources> {
	const client = getSchoolClient();
	const [
		calendarEventsRaw,
		incidentsRaw,
		involvementsRaw,
		attendanceRaw,
		sessionsRaw,
		classSubjectsRaw,
		subjectsRaw,
	] = await Promise.all([
		client.entities.calendarEvents.list({}),
		client.entities.incidents.list({}),
		client.entities.studentIncidentInvolvements.list({}),
		client.entities.attendance.list({}),
		client.entities.sessions.list({}),
		client.entities.classSubjects.list({}),
		client.entities.subjects.list({}),
	]);

	return {
		calendarEventsRaw: calendarEventsRaw ?? [],
		incidentsRaw: incidentsRaw ?? [],
		involvementsRaw: involvementsRaw ?? [],
		attendanceRaw: attendanceRaw ?? [],
		sessionsRaw: sessionsRaw ?? [],
		classSubjectsRaw: classSubjectsRaw ?? [],
		subjectsRaw: subjectsRaw ?? [],
	};
}

export function mapCalendarEvents(eventsRaw: CalendarEventRaw[]): SchoolYearEvent[] {
	return eventsRaw
		.map((event) => {
			const mockType = CALENDAR_KIND_TO_TYPE[event.kind] ?? 'ceremony';
			const scope = event.scopeKind === 'school' || !event.scopeId
				? 'all'
				: [event.scopeId];

			return {
				id: event.id,
				title: event.title,
				date: formatDate(event.startDate),
				endDate: formatDate(event.endDate) !== formatDate(event.startDate)
					? formatDate(event.endDate)
					: undefined,
				type: mockType,
				description: mockType === 'holiday'
					? 'Jour férié.'
					: mockType === 'vacation'
						? 'Vacances scolaires.'
						: mockType === 'closure'
							? 'Fermeture ou arrêt de cours.'
							: 'Événement scolaire.',
				scope,
			} satisfies SchoolYearEvent;
		})
		.sort((left, right) => left.date.localeCompare(right.date));
}

export function mapIncidents(
	incidentsRaw: IncidentRaw[],
	involvementsRaw: InvolvementRaw[],
): Incident[] {
	const involvementByIncident = new Map<string, InvolvementRaw>();
	for (const involvement of involvementsRaw) {
		if (!involvementByIncident.has(involvement.incidentId)) {
			involvementByIncident.set(involvement.incidentId, involvement);
		}
	}

	return incidentsRaw
		.map((incident) => {
			const involvement = involvementByIncident.get(incident.id);
			if (!involvement) {
				return null;
			}

			const meta = INCIDENT_UI_META[incident.id] ?? {
				category: 'Other' as const,
				severity: 'low' as const,
			};

			return {
				id: incident.id,
				studentId: involvement.studentId,
				date: formatDate(incident.date),
				category: meta.category,
				severity: meta.severity,
				summary: incident.description,
			} satisfies Incident;
		})
		.filter((incident): incident is Incident => incident !== null)
		.sort((left, right) => right.date.localeCompare(left.date));
}

export function mapAbsences(sources: SchoolLifeSources): AbsenceRecord[] {
	const subjectById = new Map(sources.subjectsRaw.map(subject => [subject.id, subject]));
	const classSubjectById = new Map(sources.classSubjectsRaw.map(entry => [entry.id, entry]));
	const sessionById = new Map(sources.sessionsRaw.map(session => [session.id, session]));

	return sources.attendanceRaw
		.filter(record => record.status === 'absent')
		.map((record) => {
			const session = sessionById.get(record.sessionId);
			const classSubject = session?.classSubjectId
				? classSubjectById.get(session.classSubjectId)
				: undefined;
			const subject = classSubject ? subjectById.get(classSubject.subjectId) : undefined;

			return {
				id: record.id,
				studentId: record.studentId,
				date: formatDate(record.date ?? session?.startsAt),
				time: session ? formatTime(session.startsAt) : '08:30',
				subject: subject?.name ?? 'Cours',
				eventType: 'Cours',
				reason: typeof record.reason === 'string' ? record.reason : undefined,
			} satisfies AbsenceRecord;
		})
		.sort((left, right) => `${right.date}${right.time}`.localeCompare(`${left.date}${left.time}`));
}

export async function loadSchoolLifeData(): Promise<{
	calendarEvents: SchoolYearEvent[];
	incidents: Incident[];
	absences: AbsenceRecord[];
}> {
	const sources = await fetchSchoolLifeSources();
	return {
		calendarEvents: mapCalendarEvents(sources.calendarEventsRaw),
		incidents: mapIncidents(sources.incidentsRaw, sources.involvementsRaw),
		absences: mapAbsences(sources),
	};
}

export async function loadCalendarEvents(): Promise<SchoolYearEvent[]> {
	const sources = await fetchSchoolLifeSources();
	return mapCalendarEvents(sources.calendarEventsRaw);
}

export async function loadIncidents(): Promise<Incident[]> {
	const sources = await fetchSchoolLifeSources();
	return mapIncidents(sources.incidentsRaw, sources.involvementsRaw);
}

export async function loadAbsences(): Promise<AbsenceRecord[]> {
	const sources = await fetchSchoolLifeSources();
	return mapAbsences(sources);
}
