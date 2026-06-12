import { describe, expect, it } from 'bun:test';
import {
	mapCalendarEventDescription,
	mapCalendarEvents,
	mapIncidentCategory,
	mapIncidentSeverity,
	mapIncidents,
} from './school-life-data';

const seedIncidents = [
	{
		id: 'i1',
		schoolId: 'sch-edaya-central',
		title: 'Repeated tardiness',
		description: 'Late to class 3 times this month.',
		date: '2026-04-12',
		kind: 'minor_infraction',
		reporterId: 'st7',
		classGroupId: '6a',
		status: 'open',
		createdAt: '2026-04-12',
		updatedAt: '2026-04-12',
	},
	{
		id: 'i2',
		schoolId: 'sch-edaya-central',
		title: 'Class disruption',
		description: 'Disruption during English class.',
		date: '2026-03-22',
		kind: 'minor_infraction',
		reporterId: 'st7',
		classGroupId: '6a',
		status: 'open',
		createdAt: '2026-03-22',
		updatedAt: '2026-03-22',
	},
	{
		id: 'i3',
		schoolId: 'sch-edaya-central',
		title: 'Recess conflict',
		description: 'Argument with classmate during recess.',
		date: '2026-04-26',
		kind: 'major_infraction',
		reporterId: 'st7',
		classGroupId: '6a',
		status: 'open',
		createdAt: '2026-04-26',
		updatedAt: '2026-04-26',
	},
] as const;

const seedInvolvements = [
	{ id: 'inv-i1-s3', incidentId: 'i1', studentId: 's3', role: 'subject' },
	{ id: 'inv-i2-s2', incidentId: 'i2', studentId: 's2', role: 'subject' },
	{ id: 'inv-i3-s3', incidentId: 'i3', studentId: 's3', role: 'subject' },
] as const;

const seedCalendarEvents = [
	{
		id: 'yc3',
		schoolId: 'sch-edaya-central',
		academicYearId: '2025',
		title: 'Vacances de printemps',
		description: 'Vacances scolaires de printemps. Réouverture le 4 mai.',
		startDate: '2026-04-20',
		endDate: '2026-05-02',
		kind: 'break',
		isNonSchoolDay: true,
		scopeKind: 'school',
		createdAt: '2026-04-20',
	},
	{
		id: 'yc10',
		schoolId: 'sch-edaya-central',
		academicYearId: '2025',
		title: 'Cérémonie de remise des prix',
		description: 'Cérémonie de fin d\'année et remise des prix au tableau d\'honneur.',
		startDate: '2026-06-26',
		endDate: '2026-06-26',
		kind: 'event',
		isNonSchoolDay: false,
		scopeKind: 'school',
		createdAt: '2026-06-26',
	},
] as const;

describe('school-life calendar mapping', () => {
	it('uses API description when present', () => {
		expect(mapCalendarEventDescription(seedCalendarEvents[0])).toBe(
			'Vacances scolaires de printemps. Réouverture le 4 mai.',
		);
	});

	it('falls back to kind label only when description is missing', () => {
		expect(mapCalendarEventDescription({
			...seedCalendarEvents[1],
			description: undefined,
		})).toBe('Événement scolaire.');
	});

	it('maps calendar events for the school calendar UI', () => {
		const events = mapCalendarEvents([...seedCalendarEvents]);

		expect(events).toHaveLength(2);
		expect(events.find(entry => entry.id === 'yc3')).toMatchObject({
			title: 'Vacances de printemps',
			type: 'vacation',
			description: 'Vacances scolaires de printemps. Réouverture le 4 mai.',
			scope: 'all',
		});
		expect(events.find(entry => entry.id === 'yc10')).toMatchObject({
			type: 'ceremony',
			description: 'Cérémonie de fin d\'année et remise des prix au tableau d\'honneur.',
		});
	});
});

describe('school-life incident mapping', () => {
	it('derives category and severity from API fields without per-id tables', () => {
		expect(mapIncidentCategory(seedIncidents[0])).toBe('Tardiness');
		expect(mapIncidentSeverity(seedIncidents[0], 'Tardiness')).toBe('low');

		expect(mapIncidentCategory(seedIncidents[1])).toBe('Behavior');
		expect(mapIncidentSeverity(seedIncidents[1], 'Behavior')).toBe('medium');

		expect(mapIncidentCategory(seedIncidents[2])).toBe('Conflict');
		expect(mapIncidentSeverity(seedIncidents[2], 'Conflict')).toBe('medium');
	});

	it('maps seeded incidents for the school events UI', () => {
		const incidents = mapIncidents([...seedIncidents], [...seedInvolvements]);

		expect(incidents).toHaveLength(3);
		expect(incidents.find(entry => entry.id === 'i1')).toMatchObject({
			studentId: 's3',
			category: 'Tardiness',
			severity: 'low',
		});
		expect(incidents.find(entry => entry.id === 'i2')).toMatchObject({
			studentId: 's2',
			category: 'Behavior',
			severity: 'medium',
		});
		expect(incidents.find(entry => entry.id === 'i3')).toMatchObject({
			studentId: 's3',
			category: 'Conflict',
			severity: 'medium',
		});
	});
});
