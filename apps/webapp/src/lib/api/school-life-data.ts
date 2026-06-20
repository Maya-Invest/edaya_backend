import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { AbsenceRecord, Incident, SchoolYearEvent } from '$lib/types/school';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

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

const CALENDAR_KIND_TO_TYPE: Record<string, SchoolYearEvent['type']> = {
	holiday: 'holiday',
	break: 'vacation',
	other: 'closure',
	event: 'ceremony',
};

const CALENDAR_KIND_FALLBACK_DESCRIPTION: Record<string, string> = {
	holiday: 'Jour férié.',
	break: 'Vacances scolaires.',
	other: 'Fermeture ou arrêt de cours.',
	event: 'Événement scolaire.',
};

export function mapCalendarEventType(kind: string): SchoolYearEvent['type'] {
	return CALENDAR_KIND_TO_TYPE[kind] ?? 'ceremony';
}

export function mapCalendarEventDescription(event: CalendarEventRaw): string {
	if (typeof event.description === 'string' && event.description.trim().length > 0) {
		return event.description;
	}

	return CALENDAR_KIND_FALLBACK_DESCRIPTION[event.kind] ?? CALENDAR_KIND_FALLBACK_DESCRIPTION.event;
}

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

export async function fetchSchoolLifeSources(client: SchoolClient): Promise<SchoolLifeSources> {
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
	const schoolEvents: SchoolYearEvent[] = [];
	const classGroups = new Map<string, {
		primary: CalendarEventRaw;
		classIds: string[];
		linkedIds: string[];
	}>();

	for (const event of eventsRaw) {
		const type = mapCalendarEventType(event.kind);
		const start = formatDate(event.startDate);
		const end = formatDate(event.endDate);

		if (event.scopeKind === 'school' || !event.scopeId) {
			schoolEvents.push({
				id: event.id,
				title: event.title,
				date: start,
				endDate: end !== start ? end : undefined,
				type,
				description: mapCalendarEventDescription(event),
				scope: 'all',
			});
			continue;
		}

		const classId = String(event.scopeId);
		const key = [
			event.title.trim(),
			start,
			end,
			event.kind,
			mapCalendarEventDescription(event),
		].join('|');

		const bucket = classGroups.get(key);
		if (bucket) {
			if (!bucket.classIds.includes(classId)) {
				bucket.classIds.push(classId);
				bucket.linkedIds.push(event.id);
			}
		}
		else {
			classGroups.set(key, {
				primary: event,
				classIds: [classId],
				linkedIds: [event.id],
			});
		}
	}

	const groupedClassEvents = [...classGroups.values()].map(({ primary, classIds, linkedIds }) => {
		const start = formatDate(primary.startDate);
		const end = formatDate(primary.endDate);
		return {
			id: primary.id,
			linkedIds: linkedIds.length > 1 ? linkedIds : undefined,
			title: primary.title,
			date: start,
			endDate: end !== start ? end : undefined,
			type: mapCalendarEventType(primary.kind),
			description: mapCalendarEventDescription(primary),
			scope: classIds.sort(),
		} satisfies SchoolYearEvent;
	});

	return [...schoolEvents, ...groupedClassEvents]
		.sort((left, right) => left.date.localeCompare(right.date));
}

function incidentLabel(incident: IncidentRaw): string {
	return `${incident.title} ${incident.description}`.toLowerCase();
}

export function mapIncidentCategory(incident: IncidentRaw): Incident['category'] {
	const label = incidentLabel(incident);

	if (/tardiness|retard|late/.test(label)) {
		return 'Tardiness';
	}
	if (/conflict|argument|dispute|fight/.test(label)) {
		return 'Conflict';
	}
	if (/disruption|behavior|behaviour|discipline|bavard/.test(label)) {
		return 'Behavior';
	}

	return 'Other';
}

export function mapIncidentSeverity(
	incident: IncidentRaw,
	category: Incident['category'],
): Incident['severity'] {
	if (incident.kind === 'emergency') {
		return 'high';
	}
	if (incident.kind === 'major_infraction') {
		return 'medium';
	}
	if (category === 'Tardiness') {
		return 'low';
	}
	if (category === 'Behavior' || category === 'Conflict') {
		return 'medium';
	}

	return 'low';
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

			const category = mapIncidentCategory(incident);

			return {
				id: incident.id,
				studentId: involvement.studentId,
				date: formatDate(incident.date),
				category,
				severity: mapIncidentSeverity(incident, category),
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

export async function loadSchoolLifeData(client: SchoolClient): Promise<{
	calendarEvents: SchoolYearEvent[];
	incidents: Incident[];
	absences: AbsenceRecord[];
}> {
	const sources = await fetchSchoolLifeSources(client);
	return {
		calendarEvents: mapCalendarEvents(sources.calendarEventsRaw),
		incidents: mapIncidents(sources.incidentsRaw, sources.involvementsRaw),
		absences: mapAbsences(sources),
	};
}

export async function loadCalendarEvents(client: SchoolClient): Promise<SchoolYearEvent[]> {
	const sources = await fetchSchoolLifeSources(client);
	return mapCalendarEvents(sources.calendarEventsRaw);
}

export async function loadIncidents(client: SchoolClient): Promise<Incident[]> {
	const sources = await fetchSchoolLifeSources(client);
	return mapIncidents(sources.incidentsRaw, sources.involvementsRaw);
}

export async function loadAbsences(client: SchoolClient): Promise<AbsenceRecord[]> {
	const sources = await fetchSchoolLifeSources(client);
	return mapAbsences(sources);
}
