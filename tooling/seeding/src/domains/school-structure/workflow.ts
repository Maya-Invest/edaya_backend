import type { FixtureDataset } from '@edaya/fixtures'
import type { SchoolStructureSeedPort } from './port'
import { AcademicPeriodType } from '@edaya/core'
import { seedDateTime } from '../../support/seed-date'

export type DevSchoolStructureInspection
  = | { status: 'skipped', schoolCount: number }
    | { status: 'ready', demoSchoolExists: boolean }

export interface SeedDevSchoolStructureOptions {
  demoSchoolExists: boolean
  ownerSubjectId?: string
}

function isoDateString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  throw new Error(`Expected ISO date string or Date, received ${String(value)}`)
}

export async function inspectDevSchoolStructure(
  port: SchoolStructureSeedPort,
  dataset: FixtureDataset,
): Promise<DevSchoolStructureInspection> {
  const state = await port.inspectSeedState(dataset.schoolId)
  const demoSchoolExists = state.schoolIds.includes(dataset.schoolId)

  if ((demoSchoolExists && state.studentCount > 0) || (!demoSchoolExists && state.schoolIds.length > 0)) {
    return { status: 'skipped', schoolCount: state.schoolIds.length }
  }

  return { status: 'ready', demoSchoolExists }
}

export async function seedDevSchoolStructure(
  port: SchoolStructureSeedPort,
  options: SeedDevSchoolStructureOptions,
  dataset: FixtureDataset,
): Promise<void> {
  const school = dataset.entities.school
  const academicYear = dataset.entities.academicYear
  const gradeLevels = dataset.entities.gradeLevels ?? []
  const academicPeriods = dataset.entities.academicPeriods ?? []
  const periodDefinitions = dataset.entities.periodDefinitions ?? []
  const staffMembers = dataset.entities.staffMembers ?? []
  const classGroups = dataset.entities.classGroups ?? []

  if (!school) {
    throw new Error('Fixture dataset must include school for school-structure seeding')
  }
  if (!school.financeCurrency) {
    throw new Error('Seed school must configure financeCurrency before financial seeding')
  }
  if (!academicYear) {
    throw new Error('Fixture dataset must include academicYear for school-structure seeding')
  }

  if (!options.demoSchoolExists) {
    await port.registerSchool({
      id: school.id,
      name: school.name,
      timeZone: school.timeZone,
      financeCurrency: school.financeCurrency,
      city: school.city ?? undefined,
      country: school.country ?? undefined,
      issuingName: school.issuingName ?? undefined,
      postalAddress: school.postalAddress ?? undefined,
      phone: school.phone ?? undefined,
      email: school.email ?? undefined,
      schoolCode: school.schoolCode ?? undefined,
      ...(options.ownerSubjectId ? { ownerSubjectId: options.ownerSubjectId } : {}),
    })
  }
  else {
    await port.configureFinanceCurrency(school.id, school.financeCurrency)
  }

  for (const gradeLevel of gradeLevels) {
    await port.saveGradeLevel({
      id: gradeLevel.id,
      schoolId: dataset.schoolId,
      name: gradeLevel.name,
      shortName: gradeLevel.shortName ?? gradeLevel.name,
      order: gradeLevel.order,
      cycle: gradeLevel.cycle ?? undefined,
    })
  }

  await port.createAcademicYear({
    id: academicYear.id,
    schoolId: dataset.schoolId,
    name: academicYear.name,
    startDate: seedDateTime(isoDateString(academicYear.startDate)),
    endDate: seedDateTime(isoDateString(academicYear.endDate)),
  })

  await port.publishAcademicYear(academicYear.id)

  const publishPeriodIds = dataset.extensions?.publishAcademicPeriodIds
  const shouldPublishPeriod = (periodId: string): boolean =>
    publishPeriodIds === undefined || publishPeriodIds.includes(periodId)

  for (const period of academicPeriods) {
    await port.createAcademicPeriod({
      id: period.id,
      schoolId: dataset.schoolId,
      academicYearId: academicYear.id,
      name: period.name,
      type: AcademicPeriodType.Trimester,
      startDate: seedDateTime(isoDateString(period.startDate)),
      endDate: seedDateTime(isoDateString(period.endDate)),
    })
    if (shouldPublishPeriod(period.id)) {
      await port.publishAcademicPeriod(period.id)
    }
  }

  for (const slot of periodDefinitions) {
    await port.savePeriodDefinition({
      id: slot.id,
      schoolId: dataset.schoolId,
      academicYearId: academicYear.id,
      name: slot.name,
      dayOfWeek: slot.dayOfWeek,
      order: slot.order,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isBreak: slot.isBreak ?? false,
      isTeachingSlot: slot.isTeachingSlot ?? true,
    })
  }

  const director = staffMembers[0]
  if (!director) {
    throw new Error('Fixture dataset staffMembers must include a director at index 0')
  }
  if (!(await port.staffMemberExists(director.id))) {
    await port.registerStaffMember({
      id: director.id,
      schoolId: dataset.schoolId,
      firstName: director.firstName,
      lastName: director.lastName,
      email: director.email ?? undefined,
      profileRole: director.profileRole ?? undefined,
      sendAccountInvitation: false,
    })
  }

  for (const member of staffMembers.slice(1)) {
    if (await port.staffMemberExists(member.id))
      continue
    await port.registerStaffMember({
      id: member.id,
      schoolId: dataset.schoolId,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email ?? undefined,
      profileRole: member.profileRole ?? undefined,
      sendAccountInvitation: false,
    })
  }

  for (const classGroup of classGroups) {
    await port.createClassGroup({
      id: classGroup.id,
      schoolId: dataset.schoolId,
      academicYearId: classGroup.academicYearId,
      gradeLevelId: classGroup.gradeLevelId,
      name: classGroup.name,
      capacity: classGroup.capacity ?? undefined,
      homeroomStaffId: classGroup.homeroomStaffId ?? undefined,
      attendanceMode: classGroup.attendanceMode,
    })
  }
}
