import type { PopulationSeedPort } from './port'
import {
  SEED_GUARDIANS,
  SEED_SCHOOL_ID,
  SEED_STUDENTS,
  splitDisplayName,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../seed-date'

export async function seedDevPopulation(port: PopulationSeedPort): Promise<void> {
  for (const student of SEED_STUDENTS) {
    const { firstName, lastName } = splitDisplayName(student.name)
    await port.registerStudent({
      id: student.id,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      birthDate: seedDateTime(student.birthDate),
    })
    await port.enrollStudent({
      id: `enr-${student.id}`,
      studentId: student.id,
      classGroupId: student.classId,
    })
  }

  for (const guardian of SEED_GUARDIANS) {
    const { firstName, lastName } = splitDisplayName(guardian.name)
    await port.registerGuardian({
      id: guardian.id,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      email: guardian.email,
      phone: guardian.phone,
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
