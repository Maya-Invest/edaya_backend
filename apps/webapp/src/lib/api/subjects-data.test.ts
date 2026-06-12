import { describe, expect, it } from 'bun:test';
import { mapClassSubjects } from './subjects-data';

const sources = {
	classSubjectsRaw: [
		{ id: 'cs-6a-math', classGroupId: '6a', subjectId: 'subj-math', completedPercentage: 0 },
		{ id: 'cs-6a-fr', classGroupId: '6a', subjectId: 'subj-fr', completedPercentage: 0 },
		{ id: 'cs-6a-hist', classGroupId: '6a', subjectId: 'subj-hist', completedPercentage: 0 },
		{ id: 'cs-6a-en', classGroupId: '6a', subjectId: 'subj-en', completedPercentage: 0 },
		{ id: 'cs-6a-eps', classGroupId: '6a', subjectId: 'subj-eps', completedPercentage: 0 },
	],
	subjectsRaw: [
		{ id: 'subj-math', schoolId: 'sch-edaya-central', name: 'Mathematics', code: 'MATH', defaultCoefficient: 3, category: 'Scientifique', color: 'mint' },
		{ id: 'subj-fr', schoolId: 'sch-edaya-central', name: 'French Literature', code: 'FR', defaultCoefficient: 2, category: 'Littéraire', color: 'warm' },
		{ id: 'subj-hist', schoolId: 'sch-edaya-central', name: 'History & Geography', code: 'HIST', defaultCoefficient: 2, category: 'Sciences humaines', color: 'sky' },
		{ id: 'subj-en', schoolId: 'sch-edaya-central', name: 'English', code: 'EN', defaultCoefficient: 2, category: 'Langues', color: 'sky' },
		{ id: 'subj-eps', schoolId: 'sch-edaya-central', name: 'Physical Education', code: 'EPS', defaultCoefficient: 1, category: 'Sport', color: 'mint' },
	],
	subjectMattersRaw: [
		{ id: 'sm-math', subjectId: 'subj-math', name: 'Core programme', description: 'Algebra fundamentals.', sequenceOrder: 1, estimatedHours: 5 },
		{ id: 'sm-fr', subjectId: 'subj-fr', name: 'Core programme', description: 'Reading and writing.', sequenceOrder: 1, estimatedHours: 4 },
		{ id: 'sm-hist', subjectId: 'subj-hist', name: 'Core programme', description: 'Antiquity to medieval Europe.', sequenceOrder: 1, estimatedHours: 3 },
		{ id: 'sm-en', subjectId: 'subj-en', name: 'Core programme', description: 'Grammar and conversation.', sequenceOrder: 1, estimatedHours: 3 },
		{ id: 'sm-eps', subjectId: 'subj-eps', name: 'Core programme', description: 'Team sports and fitness.', sequenceOrder: 1, estimatedHours: 2 },
	],
	staffMembersRaw: [
		{ id: 'st1', schoolId: 'sch-edaya-central', firstName: 'Marie', lastName: 'Dupont', email: 'm.dupont@school.edu' },
	],
	staffAssignmentsRaw: [
		{ id: 'sa-st1-math', staffId: 'st1', responsibility: 'Teacher', classSubjectId: 'cs-6a-math' },
	],
} as const;

describe('mapClassSubjects', () => {
	it('maps category and color from API subject fields', () => {
		const subjects = mapClassSubjects('6a', {
			classSubjectsRaw: [...sources.classSubjectsRaw],
			subjectsRaw: [...sources.subjectsRaw],
			subjectMattersRaw: [...sources.subjectMattersRaw],
			staffMembersRaw: [...sources.staffMembersRaw],
			staffAssignmentsRaw: [...sources.staffAssignmentsRaw],
		});

		expect(subjects).toHaveLength(5);

		const byName = Object.fromEntries(subjects.map(subject => [subject.name, subject]));

		expect(byName['Mathematics']).toMatchObject({ category: 'Scientifique', color: 'mint' });
		expect(byName['French Literature']).toMatchObject({ category: 'Littéraire', color: 'warm' });
		expect(byName['History & Geography']).toMatchObject({ category: 'Sciences humaines', color: 'sky' });
		expect(byName.English).toMatchObject({ category: 'Langues', color: 'sky' });
		expect(byName['Physical Education']).toMatchObject({ category: 'Sport', color: 'mint' });
	});

	it('uses the same color for a subject across class subject instances', () => {
		const subjects = mapClassSubjects('6a', {
			classSubjectsRaw: [
				{ id: 'cs-6a-math', classGroupId: '6a', subjectId: 'subj-math', completedPercentage: 0 },
				{ id: 'cs-6b-math', classGroupId: '6b', subjectId: 'subj-math', completedPercentage: 0 },
			],
			subjectsRaw: [
				{ id: 'subj-math', schoolId: 'sch-edaya-central', name: 'Mathematics', code: 'MATH', defaultCoefficient: 3, category: 'Scientifique', color: 'mint' },
			],
			subjectMattersRaw: [],
			staffMembersRaw: [],
			staffAssignmentsRaw: [],
		});

		const colors = new Set(subjects.map(subject => subject.color));
		expect(colors).toEqual(new Set(['mint']));
	});

	it('falls back to defaults when API fields are missing', () => {
		const subjects = mapClassSubjects('6a', {
			classSubjectsRaw: [
				{ id: 'cs-6a-sci', classGroupId: '6a', subjectId: 'subj-sci', completedPercentage: 0 },
			],
			subjectsRaw: [
				{ id: 'subj-sci', schoolId: 'sch-edaya-central', name: 'Natural Sciences', code: 'SCI', defaultCoefficient: 2 },
			],
			subjectMattersRaw: [],
			staffMembersRaw: [],
			staffAssignmentsRaw: [],
		});

		expect(subjects[0]).toMatchObject({ category: 'Scientifique', color: 'mint' });
	});
});
