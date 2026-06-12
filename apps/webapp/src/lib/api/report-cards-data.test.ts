import { describe, expect, it } from 'bun:test';
import { derivePassingScore, mapGradeScales } from './report-cards-data';

const seedGradeScalesRaw = [
	{
		id: 'gs-20',
		schoolId: 'sch-edaya-central',
		name: 'Sur 20',
		minScore: 0,
		maxScore: 20,
		isDefault: true,
		decimalPlaces: 2,
		description: 'Barème standard français — note sur 20, seuil de réussite à 10.',
		ranges: [
			{ letter: 'D', minScore: 0, maxScore: 9.99, isPassing: false, interpretation: 'Insuffisant' },
			{ letter: 'C', minScore: 10, maxScore: 13.99, isPassing: true, interpretation: 'Assez bien' },
			{ letter: 'B', minScore: 14, maxScore: 15.99, isPassing: true, interpretation: 'Bien' },
			{ letter: 'A', minScore: 16, maxScore: 20, isPassing: true, interpretation: 'Très bien' },
		],
	},
	{
		id: 'gs-100',
		schoolId: 'sch-edaya-central',
		name: 'Sur 100',
		minScore: 0,
		maxScore: 100,
		isDefault: false,
		decimalPlaces: 1,
		description: 'Pourcentage ou centième — utilisé en sport ou projets transversaux.',
		ranges: [
			{ letter: 'D', minScore: 0, maxScore: 49.99, isPassing: false, interpretation: 'Insuffisant' },
			{ letter: 'C', minScore: 50, maxScore: 59.99, isPassing: true, interpretation: 'Passable' },
			{ letter: 'B', minScore: 60, maxScore: 79.99, isPassing: true, interpretation: 'Satisfaisant' },
			{ letter: 'A', minScore: 80, maxScore: 100, isPassing: true, interpretation: 'Excellent' },
		],
	},
	{
		id: 'gs-lettres',
		schoolId: 'sch-edaya-central',
		name: 'Appréciations (A–D)',
		minScore: 0,
		maxScore: 4,
		isDefault: false,
		decimalPlaces: 0,
		description: 'A = Très bien · B = Bien · C = Assez bien · D = Insuffisant.',
		ranges: [
			{ letter: 'D', minScore: 0, maxScore: 1.99, isPassing: false, interpretation: 'Insuffisant' },
			{ letter: 'C', minScore: 2, maxScore: 2.49, isPassing: true, interpretation: 'Assez bien' },
			{ letter: 'B', minScore: 2.5, maxScore: 3.49, isPassing: true, interpretation: 'Bien' },
			{ letter: 'A', minScore: 3.5, maxScore: 4, isPassing: true, interpretation: 'Très bien' },
		],
	},
] as const;

describe('report cards grade scale mapping', () => {
	it('derives passingScore from passing ranges', () => {
		const sur20 = seedGradeScalesRaw.find(scale => scale.id === 'gs-20');
		expect(sur20).toBeDefined();
		expect(derivePassingScore([...sur20!.ranges])).toBe(10);

		const lettres = seedGradeScalesRaw.find(scale => scale.id === 'gs-lettres');
		expect(derivePassingScore([...lettres!.ranges])).toBe(2);
	});

	it('maps grade scales from API fields without per-id tables', () => {
		const scales = mapGradeScales([...seedGradeScalesRaw]);

		expect(scales.find(scale => scale.id === 'gs-20')).toMatchObject({
			name: 'Sur 20',
			passingScore: 10,
			decimalPlaces: 2,
			isDefault: true,
			description: 'Barème standard français — note sur 20, seuil de réussite à 10.',
		});
		expect(scales.find(scale => scale.id === 'gs-100')).toMatchObject({
			passingScore: 50,
			decimalPlaces: 1,
		});
		expect(scales.find(scale => scale.id === 'gs-lettres')).toMatchObject({
			passingScore: 2,
			decimalPlaces: 0,
			description: 'A = Très bien · B = Bien · C = Assez bien · D = Insuffisant.',
		});
	});
});
