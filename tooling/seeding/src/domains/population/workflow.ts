import type { FixtureDataset } from '@edaya/fixtures'
import type { PopulationSeedPort } from './port'
import { seedDateTime } from '../../support/seed-date'

function isoDateString(value: unknown): string | undefined {
  if (value == null) {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  throw new Error(`Expected ISO date string or Date, received ${String(value)}`)
}

async function seedPopulationFromDataset(
  port: PopulationSeedPort,
  dataset: FixtureDataset,
): Promise<void> {
  const seedSubjectId = (id: string) => `subject-${id}`
  const students = dataset.entities.students ?? []
  const enrollments = dataset.entities.enrollments ?? []
  const guardians = dataset.entities.guardians ?? []
  const guardianLinks = dataset.entities.guardianLinks ?? []

  for (const student of students) {
    const birthDate = isoDateString(student.birthDate)
    await port.registerStudent({
      id: student.id,
      schoolId: dataset.schoolId,
      firstName: student.firstName,
      lastName: student.lastName,
      birthDate: birthDate ? seedDateTime(birthDate) : undefined,
      subjectId: seedSubjectId(student.id),
      sendAccountInvitation: false,
    })
  }

  for (const enrollment of enrollments) {
    await port.enrollStudent({
      id: enrollment.id,
      studentId: enrollment.studentId,
      classGroupId: enrollment.classGroupId,
    })
  }

  for (const guardian of guardians) {
    await port.registerGuardian({
      id: guardian.id,
      schoolId: dataset.schoolId,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      email: guardian.email ?? undefined,
      phone: guardian.phone ?? undefined,
      subjectId: seedSubjectId(guardian.id),
      sendAccountInvitation: false,
    })
  }

  for (const link of guardianLinks) {
    await port.linkGuardianToStudent({
      id: link.id,
      guardianId: link.guardianId,
      studentId: link.studentId,
      relationship: link.relationship ?? undefined,
      isPrimary: link.isPrimary ?? true,
      legalGuardian: link.legalGuardian ?? true,
    })
  }
}

/** Auth-linked students and guardians only — for fast integration test fixtures. */
export async function seedIntegrationLightPopulation(
  port: PopulationSeedPort,
  dataset: FixtureDataset,
): Promise<void> {
  await seedPopulationFromDataset(port, dataset)
}

export async function seedDevPopulation(
  port: PopulationSeedPort,
  dataset: FixtureDataset,
): Promise<void> {
  await seedPopulationFromDataset(port, dataset)
}
