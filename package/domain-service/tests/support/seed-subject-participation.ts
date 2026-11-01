import type { SchoolRepositories } from '../../src/ports/school-repositories'
import { StudentSubjectEnrollment } from '@edaya/core'

/** Fresh fixture data, deliberately separate from production reconciliation and migration. */
export async function seedSubjectParticipation(repositories: SchoolRepositories) {
  const [placements, offerings, subjects, years] = await Promise.all([repositories.enrollments.list(), repositories.classSubjects.list(), repositories.subjects.list(), repositories.academicYears.list()])
  for (const placement of placements) {
    const year = years.find(row => row.id === placement.academicYearId)
    if (!year)
      continue
    for (const offering of offerings.filter(row => row.classGroupId === placement.classGroupId && row.isOffered)) {
      if (subjects.find(row => row.id === offering.subjectId)?.isOptional)
        continue
      const id = `fixture-participation:${placement.id}:${offering.id}`
      if (await repositories.subjectEnrollments.findById(id))
        continue
      const enrolledAt = new Date(Math.max(year.startDate.getTime(), placement.enrolledAt.getTime()))
      const endedAt = new Date(Math.min(year.endDate.getTime() + 86400000, placement.endedAt?.getTime() ?? Infinity))
      if (enrolledAt < endedAt)
        await repositories.subjectEnrollments.save(new StudentSubjectEnrollment({ id, studentClassEnrollmentId: placement.id, classSubjectId: offering.id, enrolledAt, endedAt, source: 'automatic' }))
    }
  }
}
