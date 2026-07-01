import type {
  AcademicPeriodSeedRecord,
  AcademicYearSeedRecord,
  ClassGroupSeedRecord,
  GradeLevelSeedRecord,
  PeriodDefinitionSeedRecord,
  SchoolStructureSchoolRecord,
  SchoolStructureSeedPort,
  SchoolStructureStaffRecord,
} from './port'
import {
  SEED_ACADEMIC_PERIODS,
  SEED_CLASSES,
  SEED_GRADE_LEVELS,
  SEED_PERIOD_DEFINITIONS,
  SEED_SCHOOL_ID,
  SEED_STAFF,
} from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { inspectDevSchoolStructure, seedDevSchoolStructure } from './workflow'

interface MemoryPortOptions {
  existingStaffIds?: readonly string[]
  schoolIds?: readonly string[]
  studentCount?: number
}

function createMemoryPort(options: MemoryPortOptions = {}): {
  port: SchoolStructureSeedPort
  schools: SchoolStructureSchoolRecord[]
  gradeLevels: GradeLevelSeedRecord[]
  academicYears: AcademicYearSeedRecord[]
  academicPeriods: AcademicPeriodSeedRecord[]
  publishedPeriodIds: string[]
  periodDefinitions: PeriodDefinitionSeedRecord[]
  staff: SchoolStructureStaffRecord[]
  classGroups: ClassGroupSeedRecord[]
} {
  const schools: SchoolStructureSchoolRecord[] = []
  const gradeLevels: GradeLevelSeedRecord[] = []
  const academicYears: AcademicYearSeedRecord[] = []
  const academicPeriods: AcademicPeriodSeedRecord[] = []
  const publishedPeriodIds: string[] = []
  const periodDefinitions: PeriodDefinitionSeedRecord[] = []
  const staff: SchoolStructureStaffRecord[] = []
  const classGroups: ClassGroupSeedRecord[] = []
  const existingStaffIds = new Set(options.existingStaffIds)

  return {
    port: {
      inspectSeedState: async () => ({
        schoolIds: options.schoolIds ?? [],
        studentCount: options.studentCount ?? 0,
      }),
      registerSchool: async (record) => {
        schools.push(record)
      },
      saveGradeLevel: async (record) => {
        gradeLevels.push(record)
      },
      createAcademicYear: async (record) => {
        academicYears.push(record)
      },
      createAcademicPeriod: async (record) => {
        academicPeriods.push(record)
      },
      publishAcademicPeriod: async (academicPeriodId) => {
        publishedPeriodIds.push(academicPeriodId)
      },
      savePeriodDefinition: async (record) => {
        periodDefinitions.push(record)
      },
      staffMemberExists: async staffId => existingStaffIds.has(staffId),
      registerStaffMember: async (record) => {
        staff.push(record)
      },
      createClassGroup: async (record) => {
        classGroups.push(record)
      },
    },
    schools,
    gradeLevels,
    academicYears,
    academicPeriods,
    publishedPeriodIds,
    periodDefinitions,
    staff,
    classGroups,
  }
}

describe('school-structure seed port workflow', () => {
  test('seeds the complete foundation from serializable records', async () => {
    const memory = createMemoryPort()
    const inspection = await inspectDevSchoolStructure(memory.port)

    expect(inspection).toEqual({ status: 'ready', demoSchoolExists: false })
    if (inspection.status !== 'ready') {
      throw new Error('Expected school structure to be ready')
    }

    await seedDevSchoolStructure(memory.port, {
      demoSchoolExists: inspection.demoSchoolExists,
      ownerSubjectId: 'subject-owner',
    })

    expect(memory.schools).toHaveLength(1)
    expect(memory.schools[0]?.ownerSubjectId).toBe('subject-owner')
    expect(memory.gradeLevels).toHaveLength(SEED_GRADE_LEVELS.length)
    expect(memory.academicYears).toHaveLength(1)
    expect(memory.academicYears[0]?.startDate).toBe('2025-09-01T12:00:00.000Z')
    expect(memory.academicPeriods).toHaveLength(SEED_ACADEMIC_PERIODS.length)
    expect(memory.publishedPeriodIds).toEqual(SEED_ACADEMIC_PERIODS.map(period => period.id))
    expect(memory.periodDefinitions).toHaveLength(SEED_PERIOD_DEFINITIONS.length)
    expect(memory.staff).toHaveLength(SEED_STAFF.length)
    expect(memory.classGroups).toHaveLength(SEED_CLASSES.length)
  })

  test('repairs a partial demo without replacing its existing director or school', async () => {
    const directorId = SEED_STAFF[0].id
    const memory = createMemoryPort({
      schoolIds: [SEED_SCHOOL_ID],
      existingStaffIds: [directorId],
    })
    const inspection = await inspectDevSchoolStructure(memory.port)

    expect(inspection).toEqual({ status: 'ready', demoSchoolExists: true })
    if (inspection.status !== 'ready') {
      throw new Error('Expected partial school structure to be ready')
    }

    await seedDevSchoolStructure(memory.port, inspection)

    expect(memory.schools).toHaveLength(0)
    expect(memory.staff).toHaveLength(SEED_STAFF.length - 1)
    expect(memory.staff.some(member => member.id === directorId)).toBe(false)
  })

  test('skips a populated demo or a different existing school', async () => {
    const populatedDemo = createMemoryPort({ schoolIds: [SEED_SCHOOL_ID], studentCount: 1 })
    const otherSchool = createMemoryPort({ schoolIds: ['another-school'] })

    expect(await inspectDevSchoolStructure(populatedDemo.port)).toEqual({
      status: 'skipped',
      schoolCount: 1,
    })
    expect(await inspectDevSchoolStructure(otherSchool.port)).toEqual({
      status: 'skipped',
      schoolCount: 1,
    })
  })
})
