import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { StudentClassEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../../package/domain-service/src/ports/school-repositories'
import { BusinessRuleViolationError } from '@edaya/core'
import { loadInBatches } from '../../../../../package/domain-service/src/capabilities/shared/bounded-reads'
import { closeSubjectParticipation, ensureCompulsoryParticipation } from '../../../../../package/domain-service/src/capabilities/subject-enrollment/reconcile'
import { loadPlacementInvalidationWork } from '../../../../../package/domain-service/src/capabilities/subject-enrollment/work'

// Pre-optimization placement loop retained only for controlled native benchmarks.
export async function reconcilePlacementReference(repositories: SchoolRepositories, placement: StudentClassEnrollment, previous: StudentClassEnrollment | undefined, actor: SchoolScopedActorMetadata): Promise<void> {
  const rows = await repositories.subjectEnrollments.list({ studentClassEnrollmentId: placement.id })
  if (placement.endedAt) {
    for (const row of rows) await closeSubjectParticipation(repositories, row, placement.endedAt, actor)
  }
  if (!previous) {
    const [offerings, year, group, student] = await Promise.all([
      repositories.classSubjects.list({ classGroupId: placement.classGroupId }),
      repositories.academicYears.findById(placement.academicYearId),
      repositories.classGroups.findById(placement.classGroupId),
      repositories.students.findById(placement.studentId),
    ])
    if (!year || !group || !student)
      throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PLACEMENT_INVALID', 'Placement context is missing')
    const [school, subjects] = await Promise.all([
      repositories.schools.findById(group.schoolId),
      loadInBatches(offerings.map(row => row.subjectId), ids => repositories.subjects.list({ id: { $in: ids } })),
    ])
    const byId = new Map(subjects.map(subject => [subject.id, subject]))
    const compulsory = offerings.filter(offering => offering.isOffered && !byId.get(offering.subjectId)?.isOptional)
    const work = await loadPlacementInvalidationWork(repositories, group, compulsory, placement.studentId)
    for (const offering of offerings) {
      const subject = byId.get(offering.subjectId)
      if (!subject)
        throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PLACEMENT_INVALID', 'Subject is missing')
      await ensureCompulsoryParticipation(repositories, placement, offering, actor, placement.enrolledAt, {
        bounds: { placement, offering, year, group, subject, student, school },
        existing: rows.filter(row => row.classSubjectId === offering.id),
        work: work.get(offering.id)!,
      })
    }
  }
}
