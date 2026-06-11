import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type {
	AcademicPeriod,
	AcademicYear,
	ClassNode,
	GradeLevel,
	HierarchyGroup,
	PeriodDefinition,
	School,
} from '$lib/types/school';
import { buildClassHierarchy } from '$lib/academic/hierarchy';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

export interface AppShellData {
	schools: School[];
	academicYears: AcademicYear[];
	academicPeriods: AcademicPeriod[];
	gradeLevels: GradeLevel[];
	periodDefinitions: PeriodDefinition[];
	classes: ClassNode[];
	hierarchy: HierarchyGroup[];
	studentCount: number;
}

export async function fetchAppShellData(client: SchoolClient): Promise<AppShellData> {
	const [
		schoolsRaw,
		yearsRaw,
		periodsRaw,
		gradeLevelsRaw,
		periodDefsRaw,
		classGroupsRaw,
		enrollmentsRaw,
	] = await Promise.all([
		client.entities.schools.list({}),
		client.entities.academicYears.list({}),
		client.entities.academicPeriods.list({}),
		client.entities.gradeLevels.list({}),
		client.entities.periodDefinitions.list({}),
		client.entities.classGroups.list({}),
		client.entities.enrollments.list({}),
	]);

	const schools: School[] = (schoolsRaw ?? [])
		.filter((school): school is NonNullable<typeof schoolsRaw[number]> & { id: string; name: string } =>
			Boolean(school?.id && school?.name))
		.map(s => ({
			id: s.id,
			name: s.name,
			shortName: s.name.split(' ')[0] ?? s.name,
			city: s.city ?? '',
			timeZone: s.timeZone ?? 'Europe/Paris',
		}));

	const academicYears: AcademicYear[] = (yearsRaw ?? []).map(y => ({
		id: y.id,
		schoolId: y.schoolId,
		label: y.name,
		startDate: typeof y.startDate === 'string' ? y.startDate : String(y.startDate),
		endDate: typeof y.endDate === 'string' ? y.endDate : String(y.endDate),
		status: y.isActive ? 'published' as const : 'draft' as const,
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
			status: p.isPublished ? 'published' as const : 'draft' as const,
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
}
