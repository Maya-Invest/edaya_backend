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
import { bulkDataset, demoDataset } from '@edaya/fixtures'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
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
    const inspection = await inspectDevSchoolStructure(memory.port, demoDataset)

    expect(inspection).toEqual({ status: 'ready', demoSchoolExists: false })
    if (inspection.status !== 'ready') {
      throw new Error('Expected school structure to be ready')
    }

    await seedDevSchoolStructure(memory.port, {
      demoSchoolExists: inspection.demoSchoolExists,
      ownerSubjectId: 'subject-owner',
    }, bulkDataset)

    expect(memory.schools).toHaveLength(1)
    expect(memory.schools[0]?.ownerSubjectId).toBe('subject-owner')
    expect(memory.gradeLevels).toHaveLength(demoDataset.entities.gradeLevels?.length ?? 0)
    expect(memory.academicYears).toHaveLength(1)
    expect(memory.academicYears[0]?.startDate).toBe('2025-09-01T12:00:00.000Z')
    const { academicPeriods, periodDefinitions, staffMembers } = demoDataset.entities
    expect(memory.academicPeriods).toHaveLength(academicPeriods?.length ?? 0)
    expect(memory.publishedPeriodIds).toEqual((academicPeriods ?? []).map(period => period.id))
    expect(memory.periodDefinitions).toHaveLength(periodDefinitions?.length ?? 0)
    expect(memory.staff).toHaveLength(staffMembers?.length ?? 0)
    expect(memory.classGroups).toHaveLength(bulkDataset.entities.classGroups?.length ?? 0)
  })

  test('repairs a partial demo without replacing its existing director or school', async () => {
    const directorId = demoDataset.entities.staffMembers?.[0]?.id
    if (!directorId) {
      throw new Error('Seed staff fixtures must include a director at index 0')
    }
    const memory = createMemoryPort({
      schoolIds: [SEED_SCHOOL_ID],
      existingStaffIds: [directorId],
    })
    const inspection = await inspectDevSchoolStructure(memory.port, demoDataset)

    expect(inspection).toEqual({ status: 'ready', demoSchoolExists: true })
    if (inspection.status !== 'ready') {
      throw new Error('Expected partial school structure to be ready')
    }

    await seedDevSchoolStructure(memory.port, inspection, demoDataset)

    expect(memory.schools).toHaveLength(0)
    expect(memory.staff).toHaveLength((demoDataset.entities.staffMembers?.length ?? 0) - 1)
    expect(memory.staff.some(member => member.id === directorId)).toBe(false)
  })

  test('skips a populated demo or a different existing school', async () => {
    const populatedDemo = createMemoryPort({ schoolIds: [SEED_SCHOOL_ID], studentCount: 1 })
    const otherSchool = createMemoryPort({ schoolIds: ['another-school'] })

    expect(await inspectDevSchoolStructure(populatedDemo.port, demoDataset)).toEqual({
      status: 'skipped',
      schoolCount: 1,
    })
    expect(await inspectDevSchoolStructure(otherSchool.port, demoDataset)).toEqual({
      status: 'skipped',
      schoolCount: 1,
    })
  })
})
