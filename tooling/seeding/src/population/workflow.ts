import type { PopulationSeedPort } from './port'
import {
  INTEGRATION_LIGHT_GUARDIANS,
  INTEGRATION_LIGHT_STUDENTS,
  SEED_GUARDIANS,
  SEED_SCHOOL_ID,
  SEED_STUDENTS,
  splitDisplayName,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../seed-date'

async function seedPopulationRecords(
  port: PopulationSeedPort,
  students: readonly (typeof SEED_STUDENTS)[number][],
  guardians: readonly (typeof SEED_GUARDIANS)[number][],
): Promise<void> {
  const seedSubjectId = (id: string) => `subject-${id}`

  for (const student of students) {
    const { firstName, lastName } = splitDisplayName(student.name)
    await port.registerStudent({
      id: student.id,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      birthDate: seedDateTime(student.birthDate),
      subjectId: seedSubjectId(student.id),
      sendAccountInvitation: false,
    })
    await port.enrollStudent({
      id: `enr-${student.id}`,
      studentId: student.id,
      classGroupId: student.classId,
    })
  }

  for (const guardian of guardians) {
    const { firstName, lastName } = splitDisplayName(guardian.name)
    await port.registerGuardian({
      id: guardian.id,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      email: guardian.email,
      phone: guardian.phone,
      subjectId: seedSubjectId(guardian.id),
      sendAccountInvitation: false,
    })

    for (const studentId of guardian.studentIds) {
      await port.linkGuardianToStudent({
        id: `link-${guardian.id}-${studentId}`,
        guardianId: guardian.id,
        studentId,
        relationship: guardian.relationship,
        isPrimary: true,
        legalGuardian: true,
      })
    }
  }
}

/** Auth-linked students and guardians only — for fast integration test fixtures. */
export async function seedIntegrationLightPopulation(port: PopulationSeedPort): Promise<void> {
  await seedPopulationRecords(port, INTEGRATION_LIGHT_STUDENTS, INTEGRATION_LIGHT_GUARDIANS)
}

export async function seedDevPopulation(port: PopulationSeedPort): Promise<void> {
  await seedPopulationRecords(port, SEED_STUDENTS, SEED_GUARDIANS)
}
