import type { components } from '$lib/api/schema'
import type { AcademicPeriod, AcademicYear, ClassNode, GradeLevel, PeriodDefinition, School } from '$lib/data/school'
import { query } from '$app/server'
import { buildClassHierarchy } from '$lib/data/school'
import { apiFetch } from '$lib/server/api-client'

export const getAppShellData = query(async () => {
  // 1. Fetch raw entities from the backend API
  const [
    schoolsRaw,
    yearsRaw,
    periodsRaw,
    gradeLevelsRaw,
    periodDefsRaw,
    classGroupsRaw,
    enrollmentsRaw,
  ] = await Promise.all([
    apiFetch<components['schemas']['School'][]>('/api/core/entities/schools/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['AcademicYear'][]>('/api/core/entities/academic-years/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['AcademicPeriod'][]>('/api/core/entities/academic-periods/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['GradeLevel'][]>('/api/core/entities/grade-levels/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['PeriodDefinition'][]>('/api/core/entities/period-definitions/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['ClassGroup'][]>('/api/core/entities/class-groups/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['StudentClassEnrollment'][]>('/api/core/entities/enrollments/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  ])

  // 2. Map schools
  const schools: School[] = (schoolsRaw ?? []).map(s => ({
    id: s.id,
    name: s.name,
    shortName: s.name.split(' ')[0] ?? s.name,
    city: s.city ?? '',
    timeZone: s.timeZone ?? 'Europe/Paris',
  }))

  // 3. Map academic years
  const academicYears: AcademicYear[] = (yearsRaw ?? []).map(y => ({
    id: y.id,
    schoolId: y.schoolId,
    label: y.name,
    startDate: typeof y.startDate === 'string' ? y.startDate : String(y.startDate),
    endDate: typeof y.endDate === 'string' ? y.endDate : String(y.endDate),
    status: y.isActive ? 'published' : 'draft',
  }))

  // 4. Map period definitions
  const periodDefinitions: PeriodDefinition[] = (periodDefsRaw ?? []).map(def => ({
    id: def.id,
    schoolId: def.schoolId,
    name: def.label,
    order: def.order,
  }))

  // 5. Map academic periods
  const academicPeriods: AcademicPeriod[] = (periodsRaw ?? []).map((p) => {
    // Try to find matching period definition
    const matchDef = periodDefinitions.find(def => def.name === p.name)
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
    }
  })

  // 6. Map grade levels
  const gradeLevels: GradeLevel[] = (gradeLevelsRaw ?? []).map(gl => ({
    id: gl.id,
    schoolId: gl.schoolId,
    name: gl.name,
    cycle: gl.cycle ?? '',
    order: gl.order,
  }))

  // 7. Calculate studentCount per classGroup
  const studentCountByClass: Record<string, number> = {}
  for (const enr of enrollmentsRaw ?? []) {
    if (enr.status === 'active') {
      studentCountByClass[enr.classGroupId] = (studentCountByClass[enr.classGroupId] ?? 0) + 1
    }
  }

  // 8. Map classes (ClassNodes)
  const classesList: ClassNode[] = (classGroupsRaw ?? []).map((cg) => {
    const gradeLevel = gradeLevels.find(gl => gl.id === cg.gradeLevelId)
    return {
      id: cg.id,
      schoolId: cg.schoolId,
      academicYearId: cg.academicYearId,
      gradeLevelId: cg.gradeLevelId,
      name: cg.name,
      level: gradeLevel?.cycle ?? '',
      studentCount: studentCountByClass[cg.id] ?? 0,
    }
  })

  // 9. Build class hierarchy
  const hierarchy = buildClassHierarchy(classesList, gradeLevels)

  // 10. Total student count
  // Count students having an active enrollment
  const activeStudentCount = Object.values(studentCountByClass).reduce((a, b) => a + b, 0)

  return {
    schools,
    academicYears,
    academicPeriods,
    gradeLevels,
    periodDefinitions,
    classes: classesList,
    hierarchy,
    studentCount: activeStudentCount,
  }
})
