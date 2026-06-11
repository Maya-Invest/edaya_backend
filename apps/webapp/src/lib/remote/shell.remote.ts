import type { AcademicPeriod, AcademicYear, ClassNode, GradeLevel, PeriodDefinition, School } from '$lib/data/school';
import { query } from '$app/server';
import { buildClassHierarchy } from '$lib/data/school';
import { loadSchoolProfiles } from '$lib/server/prototype-data';
import { getSchoolClient } from '$lib/server/school-client';

export const getAppShellData = query(async () => {
	const client = getSchoolClient();

	const [
		schoolsRaw,
		prototypeSchools,
		yearsRaw,
		periodsRaw,
		gradeLevelsRaw,
		periodDefsRaw,
		classGroupsRaw,
		enrollmentsRaw,
	] = await Promise.all([
		client.entities.schools.list({}),
		loadSchoolProfiles(),
		client.entities.academicYears.list({}),
		client.entities.academicPeriods.list({}),
		client.entities.gradeLevels.list({}),
		client.entities.periodDefinitions.list({}),
		client.entities.classGroups.list({}),
		client.entities.enrollments.list({}),
	]);

	const entitySchools: School[] = (schoolsRaw ?? [])
		.filter((school): school is NonNullable<typeof school> & { id: string; name: string } =>
			Boolean(school?.id && school?.name))
		.map(s => ({
			id: s.id,
			name: s.name,
			shortName: s.name.split(' ')[0] ?? s.name,
			city: s.city ?? '',
			timeZone: s.timeZone ?? 'Europe/Paris',
		}));

	const schools: School[] = prototypeSchools.length > 0 ? prototypeSchools : entitySchools;

	const academicYears: AcademicYear[] = (yearsRaw ?? []).map(y => ({
		id: y.id,
		schoolId: y.schoolId,
		label: y.name,
		startDate: typeof y.startDate === 'string' ? y.startDate : String(y.startDate),
		endDate: typeof y.endDate === 'string' ? y.endDate : String(y.endDate),
		status: y.isActive ? 'published' : 'draft',
	}));

	const periodDefinitions: PeriodDefinition[] = (periodDefsRaw ?? []).map(def => ({
		id: def.id,
		schoolId: def.schoolId,
		name: def.label,
		order: def.order,
	}));

	const academicPeriods: AcademicPeriod[] = (periodsRaw ?? []).map((p) => {
		const matchDef = periodDefinitions.find(def => def.name === p.name);
		return {
			id: p.id,
			schoolId: p.schoolId,
			academicYearId: p.academicYearId,
			periodDefinitionId: matchDef?.id ?? `def-${p.id}`,
			label: p.name,
			range: p.name.includes('1') ? 'Sep — Dec' : p.name.includes('2') ? 'Jan — Apr' : 'May — Jul',
			startDate: typeof p.startDate === 'string' ? p.startDate : String(p.startDate),
			endDate: typeof p.endDate === 'string' ? p.endDate : String(p.endDate),
			status: p.isPublished ? 'published' : 'draft',
		};
	});

	const gradeLevels: GradeLevel[] = (gradeLevelsRaw ?? []).map(gl => ({
		id: gl.id,
		schoolId: gl.schoolId,
		name: gl.name,
		cycle: gl.cycle ?? '',
		order: gl.order,
	}));

	const studentCountByClass: Record<string, number> = {};
	for (const enr of enrollmentsRaw ?? []) {
		if (enr.status === 'active') {
			studentCountByClass[enr.classGroupId] = (studentCountByClass[enr.classGroupId] ?? 0) + 1;
		}
	}

	const classesList: ClassNode[] = (classGroupsRaw ?? []).map((cg) => {
		const gradeLevel = gradeLevels.find(gl => gl.id === cg.gradeLevelId);
		return {
			id: cg.id,
			schoolId: cg.schoolId,
			academicYearId: cg.academicYearId,
			gradeLevelId: cg.gradeLevelId,
			name: cg.name,
			level: gradeLevel?.cycle ?? '',
			studentCount: studentCountByClass[cg.id] ?? 0,
		};
	});

	const hierarchy = buildClassHierarchy(classesList, gradeLevels);
	const activeStudentCount = Object.values(studentCountByClass).reduce((a, b) => a + b, 0);

	return {
		schools,
		academicYears,
		academicPeriods,
		gradeLevels,
		periodDefinitions,
		classes: classesList,
		hierarchy,
		studentCount: activeStudentCount,
	};
});
