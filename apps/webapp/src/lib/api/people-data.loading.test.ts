import { SEED_SCHOOL_ID } from '@edaya/dev-fixtures';
import { describe, expect, it } from 'bun:test';
import { loadClassPeopleData, loadGuardiansPeopleData, loadPeopleData } from './people-data';
import { createRecordingSchoolClient, entityListRequests } from './test/recording-school-client';

const classGroupId = 'class-7a';
const periodId = 'period-1';

const enrollment = {
	id: 'enrollment-1',
	schoolId: SEED_SCHOOL_ID,
	studentId: 'student-1',
	classGroupId,
	academicYearId: 'year-1',
	status: 'active',
	enrolledAt: '2026-09-01',
	createdAt: '2026-09-01',
	updatedAt: '2026-09-01',
} as const;

const student = {
	id: 'student-1',
	schoolId: SEED_SCHOOL_ID,
	firstName: 'Ada',
	lastName: 'Lovelace',
	birthDate: '2014-03-15',
	status: 'active',
	createdAt: '2026-09-01',
	updatedAt: '2026-09-01',
} as const;

function listEnvelope<T>(items: readonly T[]) {
	return items.map(item => ({ data: item }));
}

describe('people data loading', () => {
	it('loads class students with scoped list filters instead of school-wide reads', async () => {
		const { client, requests } = createRecordingSchoolClient([
			listEnvelope([enrollment]),
			listEnvelope([student]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([{
				id: 'assessment-1',
				schoolId: SEED_SCHOOL_ID,
				classGroupId,
				classSubjectId: 'cs-math',
				periodId,
				title: 'Quiz',
				maxScore: 20,
			}]),
			listEnvelope([]),
		]);

		const { students } = await loadClassPeopleData(client, classGroupId, periodId);

		expect(students).toHaveLength(1);
		expect(students[0]?.id).toBe('student-1');
		expect(students[0]?.classId).toBe(classGroupId);

		expect(entityListRequests(requests, 'enrollments')[0]?.body).toEqual({
			classGroupId,
			status: 'active',
		});
		expect(entityListRequests(requests, 'students')[0]?.body).toEqual({
			id: { $in: ['student-1'] },
		});
		expect(entityListRequests(requests, 'guardian-links')[0]?.body).toEqual({
			studentId: { $in: ['student-1'] },
		});
		expect(entityListRequests(requests, 'attendance')[0]?.body).toEqual({
			studentId: { $in: ['student-1'] },
		});
		expect(entityListRequests(requests, 'assessments')[0]?.body).toEqual({
			classGroupId,
			periodId,
		});
		expect(entityListRequests(requests, 'assessment-results')[0]?.body).toEqual({
			assessmentId: { $in: ['assessment-1'] },
			studentId: { $in: ['student-1'] },
		});

		for (const request of entityListRequests(requests, 'students')) {
			expect(request.body).not.toEqual({});
		}
	});

	it('keeps school roster routes on documented school-wide list reads', async () => {
		const { client, requests } = createRecordingSchoolClient([
			listEnvelope([student]),
			listEnvelope([enrollment]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([]),
		]);

		await loadPeopleData(client);

		expect(entityListRequests(requests, 'students')).toHaveLength(1);
		expect(entityListRequests(requests, 'students')[0]?.body).toEqual({});
		expect(entityListRequests(requests, 'enrollments')[0]?.body).toEqual({});
		expect(entityListRequests(requests, 'guardians')[0]?.body).toEqual({});
		expect(entityListRequests(requests, 'guardian-links')[0]?.body).toEqual({});
		expect(entityListRequests(requests, 'assessments')[0]?.body).toEqual({});
	});

	it('loads guardians with linked students only instead of the full school roster', async () => {
		const guardian = {
			id: 'guardian-1',
			schoolId: SEED_SCHOOL_ID,
			firstName: 'Grace',
			lastName: 'Hopper',
			email: 'grace@school.edu',
			contactMethods: [],
		};
		const link = {
			id: 'link-1',
			schoolId: SEED_SCHOOL_ID,
			guardianId: 'guardian-1',
			studentId: 'student-1',
			relationship: 'mother',
			legalGuardian: true,
			isPrimary: true,
		};

		const { client, requests } = createRecordingSchoolClient([
			listEnvelope([guardian]),
			listEnvelope([link]),
			listEnvelope([student]),
			listEnvelope([enrollment]),
		]);

		const { guardians, students } = await loadGuardiansPeopleData(client);

		expect(guardians).toHaveLength(1);
		expect(students).toHaveLength(1);
		expect(students[0]?.id).toBe('student-1');
		expect(entityListRequests(requests, 'guardians')[0]?.body).toEqual({});
		expect(entityListRequests(requests, 'guardian-links')[0]?.body).toEqual({
			guardianId: { $in: ['guardian-1'] },
		});
		expect(entityListRequests(requests, 'students')[0]?.body).toEqual({
			id: { $in: ['student-1'] },
		});
		expect(entityListRequests(requests, 'enrollments')[0]?.body).toEqual({
			studentId: { $in: ['student-1'] },
		});
		expect(entityListRequests(requests, 'attendance')).toHaveLength(0);
		expect(entityListRequests(requests, 'assessments')).toHaveLength(0);
	});

	it('requests fewer entity list calls for a class roster than a school roster', async () => {
		const classResponses = [
			listEnvelope([enrollment]),
			listEnvelope([student]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([]),
		];
		const schoolResponses = [
			listEnvelope([student]),
			listEnvelope([enrollment]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([]),
			listEnvelope([]),
		];

		const classLoad = createRecordingSchoolClient([...classResponses]);
		await loadClassPeopleData(classLoad.client, classGroupId, periodId);

		const schoolLoad = createRecordingSchoolClient([...schoolResponses]);
		await loadPeopleData(schoolLoad.client);

		const classListCount = classLoad.requests.filter(request => request.path.endsWith('/list')).length;
		const schoolListCount = schoolLoad.requests.filter(request => request.path.endsWith('/list')).length;

		expect(classListCount).toBeLessThan(schoolListCount);
	});
});
