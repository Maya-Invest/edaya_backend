import { describe, expect, it } from 'bun:test';
import type { Evaluation, PlanningEvent, Student } from '$lib/types/school';
import {
	seedEvaluationsCollection,
	seedPlanningCollection,
	seedRolePermissionsCollection,
	seedStudentsCollection,
} from './seed-policies';

function student(id: string, classId: string): Student {
	return {
		id,
		classId,
		name: `Student ${id}`,
		initials: id.slice(0, 2).toUpperCase(),
		email: `${id}@school.edu`,
		birthdate: '2010-01-01',
		guardian: 'Guardian',
		attendance: 95,
		average: 14,
		status: 'active',
	};
}

function planningEvent(id: string, classId: string): PlanningEvent {
	return {
		id,
		classId,
		title: `Event ${id}`,
		subject: 'Math',
		day: 'Mon',
		start: '08:00',
		end: '09:00',
		room: 'A1',
	};
}

function evaluation(id: string, classId: string): Evaluation {
	return {
		id,
		classId,
		title: `Eval ${id}`,
		subject: 'Math',
		date: '2025-01-01',
		coefficient: 1,
		averageMark: 12,
		outOf: 20,
		graded: 1,
		total: 1,
	};
}

describe('entity store seed policies', () => {
	it('merges students school-wide by id', () => {
		let students = seedStudentsCollection([], [student('s1', '6a'), student('s2', '6b')]);
		students = seedStudentsCollection(students, [
			student('s2', '6b'),
			{ ...student('s2', '6b'), name: 'Updated S2' },
			student('s3', '6c'),
		]);

		expect(students.map(entry => entry.id).sort()).toEqual(['s1', 's2', 's3']);
		expect(students.find(entry => entry.id === 's2')?.name).toBe('Updated S2');
	});

	it('replaces the class slice when seeding students with class scope', () => {
		let students = seedStudentsCollection([], [student('s1', '6a'), student('s2', '6a'), student('s3', '6b')]);
		students = seedStudentsCollection(students, [student('s4', '6a')], { classId: '6a' });

		expect(students.filter(entry => entry.classId === '6a').map(entry => entry.id)).toEqual(['s4']);
		expect(students.filter(entry => entry.classId === '6b').map(entry => entry.id)).toEqual(['s3']);
	});

	it('replaces the class slice for planning events', () => {
		let planning = seedPlanningCollection([], [planningEvent('p1', '6a'), planningEvent('p2', '6b')], { classId: '6a' });
		planning = seedPlanningCollection(planning, [planningEvent('p3', '6a')], { classId: '6a' });

		expect(planning.filter(entry => entry.classId === '6a').map(entry => entry.id)).toEqual(['p3']);
		expect(planning.filter(entry => entry.classId === '6b').map(entry => entry.id)).toEqual(['p2']);
	});

	it('replaces the class slice for evaluations', () => {
		let evaluations = seedEvaluationsCollection([], [evaluation('e1', '6a')], { classId: '6a' });
		evaluations = seedEvaluationsCollection(evaluations, [evaluation('e2', '6a'), evaluation('e3', '6b')], { classId: '6b' });
		evaluations = seedEvaluationsCollection(evaluations, [evaluation('e4', '6a')], { classId: '6a' });

		expect(evaluations.filter(entry => entry.classId === '6a').map(entry => entry.id)).toEqual(['e4']);
		expect(evaluations.filter(entry => entry.classId === '6b').map(entry => entry.id)).toEqual(['e3']);
	});

	it('replaces role permission matrices entirely', () => {
		let permissions = seedRolePermissionsCollection({
			roleCrudMatrix: { owner: { students: { read: true, create: true, update: true, delete: true } } },
			roleEnabledPermissions: { owner: { students: true } },
		});
		permissions = seedRolePermissionsCollection({
			roleCrudMatrix: { professeur: { students: { read: true, create: false, update: false, delete: false } } },
			roleEnabledPermissions: { professeur: { students: true } },
		});

		expect(permissions.roleCrudMatrix.owner).toBeUndefined();
		expect(permissions.roleCrudMatrix.professeur?.students?.read).toBe(true);
		expect(permissions.roleEnabledPermissions.professeur?.students).toBe(true);
	});
});
