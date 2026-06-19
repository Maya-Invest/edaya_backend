import { describe, expect, test } from 'bun:test';
import {
	calendarSlotFromDates,
	mondayOfWeek,
	planningSlotSignature,
	sessionInstantsForSlot,
} from './planning-calendar';

describe('planning-calendar', () => {
	test('calendarSlotFromDates maps local times to weekday slot', () => {
		const weekStart = mondayOfWeek(new Date(2026, 4, 11));
		const start = new Date(weekStart);
		start.setDate(start.getDate() + 2);
		start.setHours(10, 15, 0, 0);
		const end = new Date(start);
		end.setHours(11, 45, 0, 0);

		expect(calendarSlotFromDates(start, end)).toEqual({
			day: 'Wed',
			startTime: '10:15',
			endTime: '11:45',
			dayOfWeek: 'wednesday',
			startsAt: start,
			endsAt: end,
		});
	});

	test('sessionInstantsForSlot keeps reference week and uses UTC wall-clock', () => {
		const referenceStartsAt = '2026-05-11T08:30:00.000Z';
		const { startsAt, endsAt } = sessionInstantsForSlot(referenceStartsAt, {
			day: 'Wed',
			startTime: '10:15',
			endTime: '11:45',
		});

		expect(startsAt.toISOString()).toBe('2026-05-13T10:15:00.000Z');
		expect(endsAt.toISOString()).toBe('2026-05-13T11:45:00.000Z');
	});

	test('planningSlotSignature detects unchanged slots', () => {
		const left = { day: 'Mon' as const, start: '08:30', end: '09:30' };
		const right = { day: 'Mon' as const, start: '08:30', end: '09:30' };
		expect(planningSlotSignature(left)).toBe(planningSlotSignature(right));
	});
});
