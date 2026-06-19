import type { PlanningEvent } from '$lib/types/school';

export const TIMETABLE_DAY_OFFSET: Record<PlanningEvent['day'], number> = {
	Mon: 0,
	Tue: 1,
	Wed: 2,
	Thu: 3,
	Fri: 4,
};

export const TIMETABLE_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type ScheduleDayOfWeek =
	| 'monday'
	| 'tuesday'
	| 'wednesday'
	| 'thursday'
	| 'friday'
	| 'saturday'
	| 'sunday';

const DAY_LABEL_TO_SCHEDULE: Record<PlanningEvent['day'], ScheduleDayOfWeek> = {
	Mon: 'monday',
	Tue: 'tuesday',
	Wed: 'wednesday',
	Thu: 'thursday',
	Fri: 'friday',
};

export interface PlanningSlotFromDates {
	day: PlanningEvent['day'];
	startTime: string;
	endTime: string;
	dayOfWeek: ScheduleDayOfWeek;
	startsAt: Date;
	endsAt: Date;
}

export function mondayOfWeek(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	const diff = (d.getDay() + 6) % 7;
	d.setDate(d.getDate() - diff);
	return d;
}

/** Monday 00:00 UTC for the week containing `date` (matches seed session instants). */
export function mondayOfWeekUtc(date: Date): Date {
	const d = new Date(date);
	d.setUTCHours(0, 0, 0, 0);
	const diff = (d.getUTCDay() + 6) % 7;
	d.setUTCDate(d.getUTCDate() - diff);
	return d;
}

/**
 * Builds concrete session instants on the same reference week as `referenceStartsAt`,
 * using UTC wall-clock times (same convention as dev seed `parseSeedDateTime`).
 */
export function sessionInstantsForSlot(
	referenceStartsAt: Date | string,
	slot: Pick<PlanningSlotFromDates, 'day' | 'startTime' | 'endTime'>,
): { startsAt: Date; endsAt: Date } {
	const weekStart = mondayOfWeekUtc(new Date(referenceStartsAt));

	const startsAt = new Date(weekStart);
	startsAt.setUTCDate(startsAt.getUTCDate() + TIMETABLE_DAY_OFFSET[slot.day]);
	const startParts = parseTimeOfDay(slot.startTime);
	startsAt.setUTCHours(startParts.hours, startParts.minutes, 0, 0);

	const endsAt = new Date(weekStart);
	endsAt.setUTCDate(endsAt.getUTCDate() + TIMETABLE_DAY_OFFSET[slot.day]);
	const endParts = parseTimeOfDay(slot.endTime);
	endsAt.setUTCHours(endParts.hours, endParts.minutes, 0, 0);

	return { startsAt, endsAt };
}

function formatTimeOfDay(date: Date): string {
	const hours = `${date.getHours()}`.padStart(2, '0');
	const minutes = `${date.getMinutes()}`.padStart(2, '0');
	return `${hours}:${minutes}`;
}

function weekdayLabel(date: Date): PlanningEvent['day'] {
	const label = TIMETABLE_DAY_LABELS[date.getDay()] ?? 'Mon';
	if (label === 'Sun' || label === 'Sat') {
		return 'Mon';
	}
	return label;
}

export function calendarSlotFromDates(start: Date, end: Date): PlanningSlotFromDates {
	const day = weekdayLabel(start);
	return {
		day,
		startTime: formatTimeOfDay(start),
		endTime: formatTimeOfDay(end),
		dayOfWeek: DAY_LABEL_TO_SCHEDULE[day],
		startsAt: start,
		endsAt: end,
	};
}

export function planningSlotSignature(event: Pick<PlanningEvent, 'day' | 'start' | 'end'>): string {
	return `${event.day}|${event.start}|${event.end}`;
}

export function formatPlanningSlotLabel(
	event: Pick<PlanningEvent, 'day' | 'start' | 'end' | 'title'>,
	dayLabel: (day: PlanningEvent['day']) => string,
): string {
	return `${event.title} · ${dayLabel(event.day)} ${event.start}–${event.end}`;
}

function parseTimeOfDay(time: string): { hours: number; minutes: number } {
	const [hours = 0, minutes = 0] = time.split(':').map(part => Number.parseInt(part, 10));
	return { hours, minutes };
}

export interface TimetableCalendarEvent {
	id: string;
	start: Date;
	end: Date;
	text: string;
	subject: string;
	room: string;
	teacher: string;
	css?: string;
}

export function subjectToneClass(subject: string): string {
	const tones = ['tone-a', 'tone-b', 'tone-c', 'tone-d'];
	let hash = 0;
	for (let i = 0; i < subject.length; i++) hash = (hash + subject.charCodeAt(i)) % tones.length;
	return `edaya-subject-${tones[hash]}`;
}

export function mapPlanningToCalendarEvents(
	events: PlanningEvent[],
	weekStart: Date,
): TimetableCalendarEvent[] {
	return events.map((event) => {
		const start = new Date(weekStart);
		start.setDate(start.getDate() + TIMETABLE_DAY_OFFSET[event.day]);
		const startParts = parseTimeOfDay(event.start);
		start.setHours(startParts.hours, startParts.minutes, 0, 0);

		const end = new Date(start);
		const endParts = parseTimeOfDay(event.end);
		end.setHours(endParts.hours, endParts.minutes, 0, 0);

		return {
			id: event.id,
			start,
			end,
			text: event.title,
			subject: event.subject,
			room: event.room,
			teacher: event.teacher,
			css: subjectToneClass(event.subject),
		};
	});
}

export function timetableHours(events: PlanningEvent[]): { startHour: number; endHour: number } {
	if (events.length === 0) return { startHour: 7, endHour: 18 };

	let minHour = 24;
	let maxMinutes = 0;

	for (const event of events) {
		const [startHour = 0, startMinute = 0] = event.start.split(':').map(Number);
		const [endHour = 0, endMinute = 0] = event.end.split(':').map(Number);
		minHour = Math.min(minHour, startHour);
		maxMinutes = Math.max(maxMinutes, endHour * 60 + endMinute);
	}

	const endHour = Math.ceil(maxMinutes / 60);

	return {
		startHour: Math.max(6, minHour - 1),
		endHour: Math.min(21, endHour + 1),
	};
}
