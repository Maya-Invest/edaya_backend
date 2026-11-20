import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { StudentClassEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { StudentSubjectEnrollment } from '@edaya/core'
import { enrollmentBounds, persistSubjectEnrollment } from './persistence'

export async function subjectTransferImpact(repositories: SchoolRepositories, placement: StudentClassEnrollment, nextClassGroupId: string, at: Date) {
  const target = await repositories.classGroups.findById(nextClassGroupId)
  const rows = (await repositories.subjectEnrollments.list({ studentClassEnrollmentId: placement.id })).filter(row => row.overlaps(at, row.endedAt ?? new Date(8640000000000000)))
  const offerings = await repositories.classSubjects.findByIds([...new Set(rows.map(row => row.classSubjectId))])
  const subjects = new Map((await repositories.subjects.findByIds(offerings.map(row => row.subjectId))).map(row => [row.id, row]))
  const origin = new Map(offerings.map(row => [row.id, row]))
  const destination = target?.academicYearId === placement.academicYearId ? await repositories.classSubjects.list({ classGroupId: nextClassGroupId, isOffered: true }) : []
  const optional = rows.filter(row => subjects.get(origin.get(row.classSubjectId)?.subjectId ?? '')?.isOptional)
  return optional.map((row) => {
    const subject = subjects.get(origin.get(row.classSubjectId)!.subjectId)!
    return { enrollment: row, subjectId: subject.id, subjectName: subject.name, destinationClassSubjectId: destination.find(offering => offering.subjectId === subject.id)?.id }
  })
}

export async function carrySubjectChoices(repositories: SchoolRepositories, impact: Awaited<ReturnType<typeof subjectTransferImpact>>, successor: StudentClassEnrollment, _actor: SchoolScopedActorMetadata) {
  for (const choice of impact) {
    if (!choice.destinationClassSubjectId)
      continue
    const bounds = await enrollmentBounds(repositories, successor.id, choice.destinationClassSubjectId)
    if (!bounds.subject.isOptional)
      continue // The admission hook already filled compulsory coverage.
    const enrolledAt = new Date(Math.max(successor.enrolledAt.getTime(), choice.enrollment.enrolledAt.getTime()))
    const endedAt = new Date(Math.min(bounds.end.getTime(), choice.enrollment.endedAt?.getTime() ?? Infinity))
    if (endedAt <= enrolledAt || (choice.enrollment.scope === 'periods' && !choice.enrollment.periods.some(period => period.endsAt > enrolledAt)))
      continue
    await persistSubjectEnrollment(repositories, new StudentSubjectEnrollment({ id: crypto.randomUUID(), studentClassEnrollmentId: successor.id, classSubjectId: choice.destinationClassSubjectId, enrolledAt, endedAt, source: 'explicit', scope: choice.enrollment.scope, periods: choice.enrollment.periods.filter(period => period.endsAt > enrolledAt).map(period => ({ ...period, activatedAt: new Date(Math.max(enrolledAt.getTime(), period.activatedAt.getTime())) })) }))
  }
}
