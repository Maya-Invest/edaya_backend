import type {
  EnrollmentSeedRecord,
  GuardianSeedRecord,
  GuardianStudentLinkSeedRecord,
  PopulationSeedPort,
  StudentSeedRecord,
} from './port'
import { devSeedDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevPopulation } from './workflow'

describe('population seed port workflow', () => {
  test('seeds students, enrollments, guardians, and links from plain records', async () => {
    const students: StudentSeedRecord[] = []
    const enrollments: EnrollmentSeedRecord[] = []
    const guardians: GuardianSeedRecord[] = []
    const links: GuardianStudentLinkSeedRecord[] = []
    const port: PopulationSeedPort = {
      registerStudent: async (record) => {
        students.push(record)
      },
      enrollStudent: async (record) => {
        enrollments.push(record)
      },
      registerGuardian: async (record) => {
        guardians.push(record)
      },
      linkGuardianToStudent: async (record) => {
        links.push(record)
      },
    }

    await seedDevPopulation(port, devSeedDataset)

    expect(students).toHaveLength(devSeedDataset.entities.students?.length ?? 0)
    expect(students[0]?.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(enrollments).toHaveLength(devSeedDataset.entities.enrollments?.length ?? 0)
    expect(guardians).toHaveLength(devSeedDataset.entities.guardians?.length ?? 0)
    expect([...students, ...guardians].every(profile => !('subjectId' in profile))).toBe(true)
    expect(links).toHaveLength(devSeedDataset.entities.guardianLinks?.length ?? 0)
    expect(links.every(link => link.isPrimary && link.legalGuardian)).toBe(true)
  })
})
