import type {
  EnrollmentSeedRecord,
  GuardianSeedRecord,
  GuardianStudentLinkSeedRecord,
  PopulationSeedPort,
  StudentSeedRecord,
} from './port'
import { SEED_GUARDIANS, SEED_STUDENTS } from '@edaya/dev-fixtures'
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

    await seedDevPopulation(port)

    expect(students).toHaveLength(SEED_STUDENTS.length)
    expect(students[0]?.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(enrollments).toHaveLength(SEED_STUDENTS.length)
    expect(guardians).toHaveLength(SEED_GUARDIANS.length)
    expect(links).toHaveLength(
      SEED_GUARDIANS.reduce((count, guardian) => count + guardian.studentIds.length, 0),
    )
    expect(links.every(link => link.isPrimary && link.legalGuardian)).toBe(true)
  })
})
