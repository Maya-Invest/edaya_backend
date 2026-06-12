import { describe, expect, it } from 'bun:test';
import {
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
