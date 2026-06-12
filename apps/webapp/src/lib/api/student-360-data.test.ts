import { describe, expect, it } from 'bun:test';
import { mapHealthProfiles } from './student-360-data';

const seedHealthProfiles = [
	{
		id: 'hp-s1',
		schoolId: 'sch-edaya-central',
		studentId: 's1',
		bloodType: 'A+',
		allergies: 'Pollen',
		medicalConditions: 'Asthme',
		medications: undefined,
		clinicalNotes: 'Mild seasonal allergies.',
		lastVisit: '2026-02-14',
		createdAt: '2026-02-14',
		updatedAt: '2026-02-14',
	},
	{
		id: 'hp-s3',
		schoolId: 'sch-edaya-central',
		studentId: 's3',
		bloodType: 'O-',
		allergies: 'Peanuts, Shellfish',
		medicalConditions: 'Asthme, Epilepsie',
		medications: 'EpiPen',
		clinicalNotes: 'Severe peanut allergy. EpiPen in nurse\'s office.',
		lastVisit: '2026-04-08',
		createdAt: '2026-04-08',
		updatedAt: '2026-04-08',
	},
] as const;

describe('student 360 health mapping', () => {
	it('maps health fields from API without per-student tables', () => {
		const records = mapHealthProfiles([...seedHealthProfiles]);

		expect(records.s1).toMatchObject({
			bloodType: 'A+',
			allergies: ['Pollen'],
			medications: [],
			chronicConditions: ['Asthme'],
			lastVisit: '2026-02-14',
			notes: 'Mild seasonal allergies.',
		});
		expect(records.s3).toMatchObject({
			bloodType: 'O-',
			allergies: ['Peanuts', 'Shellfish'],
			medications: ['EpiPen'],
			chronicConditions: ['Asthme', 'Epilepsie'],
			lastVisit: '2026-04-08',
			notes: 'Severe peanut allergy. EpiPen in nurse\'s office.',
		});
	});
});
