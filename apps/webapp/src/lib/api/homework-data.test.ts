import { describe, expect, it } from 'bun:test';
import { mapDeadlines } from './homework-data';

const sources = {
	homeworkAssignmentsRaw: [
		{
			id: 'd1',
			schoolId: 'sch-edaya-central',
			classGroupId: '6a',
			classSubjectId: 'cs-6a-math',
			title: 'Algebra exercise sheet #4',
			description: 'Complete exercises 1 to 12.',
			dueDate: '2026-05-18',
			assignedDate: '2026-05-11',
			type: 'homework',
			attachments: [{ name: 'exercises_ch4.pdf', size: '320 KB' }],
		},
		{
			id: 'd2',
			schoolId: 'sch-edaya-central',
			classGroupId: '6b',
			classSubjectId: 'cs-6b-math',
			title: 'Other class homework',
			description: 'Should not appear when filtering 6a.',
			dueDate: '2026-05-20',
			assignedDate: '2026-05-12',
			type: 'homework',
			attachments: [],
		},
	],
	homeworkSubmissionsRaw: [
		{ id: 'hs-d1-s1', homeworkAssignmentId: 'd1', studentId: 's1', status: 'submitted', submittedAt: '2026-05-15' },
		{ id: 'hs-d1-s3', homeworkAssignmentId: 'd1', studentId: 's3', status: 'missing' },
	],
	classSubjectsRaw: [
		{ id: 'cs-6a-math', classGroupId: '6a', subjectId: 'subj-math', completedPercentage: 0 },
		{ id: 'cs-6b-math', classGroupId: '6b', subjectId: 'subj-math', completedPercentage: 0 },
	],
	subjectsRaw: [
		{ id: 'subj-math', schoolId: 'sch-edaya-central', name: 'Mathematics', code: 'MATH', defaultCoefficient: 3 },
	],
} as const;

describe('mapDeadlines', () => {
	it('maps homework assignments with subject labels and submissions', () => {
		const deadlines = mapDeadlines('6a', {
			homeworkAssignmentsRaw: [...sources.homeworkAssignmentsRaw],
			homeworkSubmissionsRaw: [...sources.homeworkSubmissionsRaw],
			classSubjectsRaw: [...sources.classSubjectsRaw],
			subjectsRaw: [...sources.subjectsRaw],
		});

		expect(deadlines).toHaveLength(1);
		expect(deadlines[0]).toMatchObject({
			id: 'd1',
			classId: '6a',
			subject: 'Mathematics',
			type: 'Homework',
			attachments: [{ name: 'exercises_ch4.pdf', size: '320 KB' }],
		});
		expect(deadlines[0]?.submissions).toEqual([
			{ studentId: 's1', status: 'submitted', date: '2026-05-15' },
			{ studentId: 's3', status: 'missing', date: undefined },
		]);
	});

	it('filters deadlines by class group', () => {
		const deadlines = mapDeadlines('6a', {
			homeworkAssignmentsRaw: [...sources.homeworkAssignmentsRaw],
			homeworkSubmissionsRaw: [],
			classSubjectsRaw: [...sources.classSubjectsRaw],
			subjectsRaw: [...sources.subjectsRaw],
		});

		expect(deadlines.every(deadline => deadline.classId === '6a')).toBe(true);
	});

	it('sorts deadlines by due date', () => {
		const deadlines = mapDeadlines(undefined, {
			homeworkAssignmentsRaw: [
				{ ...sources.homeworkAssignmentsRaw[1], dueDate: '2026-05-25' },
				{ ...sources.homeworkAssignmentsRaw[0], dueDate: '2026-05-18' },
			],
			homeworkSubmissionsRaw: [],
			classSubjectsRaw: [...sources.classSubjectsRaw],
			subjectsRaw: [...sources.subjectsRaw],
		});

		expect(deadlines.map(deadline => deadline.dueDate)).toEqual(['2026-05-18', '2026-05-25']);
	});
});
