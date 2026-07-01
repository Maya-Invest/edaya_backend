import type { SchoolStructureSeedPort } from './port'
import { AcademicPeriodType } from '@edaya/core'
import {
  SEED_ACADEMIC_PERIODS,
  SEED_ACADEMIC_YEAR_ID,
  SEED_CLASSES,
  SEED_GRADE_LEVELS,
  SEED_PERIOD_DEFINITIONS,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_PROFILE,
  SEED_STAFF,
  splitDisplayName,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../../support/seed-date'

export type DevSchoolStructureInspection
  = | { status: 'skipped', schoolCount: number }
    | { status: 'ready', demoSchoolExists: boolean }

export interface SeedDevSchoolStructureOptions {
  demoSchoolExists: boolean
  ownerSubjectId?: string
}

export async function inspectDevSchoolStructure(
  port: SchoolStructureSeedPort,
): Promise<DevSchoolStructureInspection> {
  const state = await port.inspectSeedState(SEED_SCHOOL_ID)
  const demoSchoolExists = state.schoolIds.includes(SEED_SCHOOL_ID)

  if ((demoSchoolExists && state.studentCount > 0) || (!demoSchoolExists && state.schoolIds.length > 0)) {
    return { status: 'skipped', schoolCount: state.schoolIds.length }
  }

  return { status: 'ready', demoSchoolExists }
}

export async function seedDevSchoolStructure(
  port: SchoolStructureSeedPort,
  options: SeedDevSchoolStructureOptions,
): Promise<void> {
  const seedSubjectId = (id: string) => `subject-${id}`

  if (!options.demoSchoolExists) {
    await port.registerSchool({
      ...SEED_SCHOOL_PROFILE,
      ...(options.ownerSubjectId ? { ownerSubjectId: options.ownerSubjectId } : {}),
    })
  }

  for (const gradeLevel of SEED_GRADE_LEVELS) {
    await port.saveGradeLevel({
      ...gradeLevel,
      schoolId: SEED_SCHOOL_ID,
    })
  }

  await port.createAcademicYear({
    id: SEED_ACADEMIC_YEAR_ID,
    schoolId: SEED_SCHOOL_ID,
    name: '2025 — 2026',
    startDate: seedDateTime('2025-09-01'),
    endDate: seedDateTime('2026-07-03'),
  })

  for (const period of SEED_ACADEMIC_PERIODS) {
    await port.createAcademicPeriod({
      id: period.id,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      name: period.name,
      type: AcademicPeriodType.Trimester,
      startDate: seedDateTime(period.startDate),
      endDate: seedDateTime(period.endDate),
    })
    await port.publishAcademicPeriod(period.id)
  }

  for (const slot of SEED_PERIOD_DEFINITIONS) {
    await port.savePeriodDefinition({
      ...slot,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
    })
  }

  const director = SEED_STAFF[0]
  if (!(await port.staffMemberExists(director.id))) {
    const directorName = splitDisplayName(director.name)
    await port.registerStaffMember({
      id: director.id,
      schoolId: SEED_SCHOOL_ID,
      firstName: directorName.firstName,
      lastName: directorName.lastName,
      email: director.email,
      subjectId: seedSubjectId(director.id),
      sendAccountInvitation: false,
    })
  }

  for (const member of SEED_STAFF.slice(1)) {
    const { firstName, lastName } = splitDisplayName(member.name)
    await port.registerStaffMember({
      id: member.id,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      email: member.email,
      subjectId: seedSubjectId(member.id),
      sendAccountInvitation: false,
    })
  }

  for (const classGroup of SEED_CLASSES) {
    await port.createClassGroup({
      id: classGroup.id,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      gradeLevelId: classGroup.gradeLevelId,
      name: classGroup.name,
      capacity: classGroup.capacity,
      homeroomStaffId: 'homeroomStaffId' in classGroup ? classGroup.homeroomStaffId : undefined,
    })
  }
}
