import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { ClassSubject, StudentClassEnrollment, Subject } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { resolveAuditActorId } from '@edaya/authorization'
import { BusinessRuleViolationError, OccurrenceStatus, StudentSubjectEnrollment } from '@edaya/core'
import { assessmentDate } from '../academics/marks-state'
import { regeneratableSessionIds } from '../timetable/regeneration-protection'
import { bumpParticipation, enrollmentBounds, persistSubjectEnrollment, withdrawSubjectEnrollment } from './persistence'

export async function ensureCompulsoryParticipation(repositories: SchoolRepositories, placement: StudentClassEnrollment, offering: ClassSubject, _actor: SchoolScopedActorMetadata, from: Date): Promise<void> {
  const bounds = await enrollmentBounds(repositories, placement.id, offering.id)
  if (!offering.isOffered || bounds.subject.isOptional)
    return
  if (bounds.end <= from || bounds.end <= bounds.start || (placement.endedAt && placement.endedAt <= new Date()))
    return
  const existing = (await repositories.subjectEnrollments.list({ studentClassEnrollmentId: placement.id, classSubjectId: offering.id })).find(row => !row.deletedAt)
  if (existing?.scope === 'annual' && existing.endedAt?.getTime() === bounds.end.getTime())
    return
  await persistSubjectEnrollment(repositories, new StudentSubjectEnrollment({
    ...existing?.data,
    id: existing?.id ?? crypto.randomUUID(),
    studentClassEnrollmentId: placement.id,
    classSubjectId: offering.id,
    enrolledAt: new Date(Math.max(bounds.start.getTime(), existing?.scope === 'annual' ? existing.enrolledAt.getTime() : from.getTime())),
    endedAt: bounds.end,
    scope: 'annual',
    periods: [],
    source: 'automatic',
    revision: (existing?.revision ?? -1) + 1,
  }), existing)
}

export async function closeSubjectParticipation(repositories: SchoolRepositories, row: StudentSubjectEnrollment, at: Date, actor: SchoolScopedActorMetadata): Promise<void> {
  if (row.deletedAt)
    return
  // A scheduled class closure still bounds the current selection until the closure instant.
  if (at > new Date() && row.enrolledAt < at) {
    await persistSubjectEnrollment(repositories, new StudentSubjectEnrollment({ ...row.data, endedAt: new Date(Math.min(at.getTime(), row.endedAt?.getTime() ?? Infinity)), revision: row.revision + 1 }), row)
    return
  }
  await withdrawSubjectEnrollment(repositories, row, resolveAuditActorId(actor), new Date())
}

export async function reconcilePlacement(repositories: SchoolRepositories, placement: StudentClassEnrollment, previous: StudentClassEnrollment | undefined, actor: SchoolScopedActorMetadata): Promise<void> {
  const rows = await repositories.subjectEnrollments.list({ studentClassEnrollmentId: placement.id })
  if (placement.endedAt) {
    for (const row of rows) await closeSubjectParticipation(repositories, row, placement.endedAt, actor)
  }
  if (!previous) {
    for (const offering of await repositories.classSubjects.list({ classGroupId: placement.classGroupId }))
      await ensureCompulsoryParticipation(repositories, placement, offering, actor, placement.enrolledAt)
  }
}

export async function reconcileOffering(repositories: SchoolRepositories, offering: ClassSubject, previous: ClassSubject | undefined, actor: SchoolScopedActorMetadata): Promise<void> {
  if (previous && previous.isOffered === offering.isOffered)
    return
  const at = new Date()
  if (!offering.isOffered) {
    const group = await repositories.classGroups.findById(offering.classGroupId)
    if (!group)
      throw new BusinessRuleViolationError('CLASS_NOT_FOUND', 'Class not found')
    const assessments = await repositories.assessments.list({ classSubjectId: offering.id })
    const futureAssessments = []
    for (const assessment of assessments) {
      if (await assessmentDate(assessment, repositories) >= at)
        futureAssessments.push(assessment.id)
    }
    if (futureAssessments.length)
      throw new BusinessRuleViolationError('SUBJECT_OFFERING_FUTURE_ASSESSMENTS', 'Resolve future assessments before disabling this subject', { assessmentIds: futureAssessments })
    const sessions = (await repositories.lessonSessions.list({ classSubjectId: offering.id, endsAt: { $gt: at } })).filter(row => row.status !== OccurrenceStatus.Cancelled)
    const allowed = new Set(await regeneratableSessionIds(repositories, group.schoolId, sessions))
    if (sessions.some(row => row.startsAt < at || !allowed.has(row.id)))
      throw new BusinessRuleViolationError('SUBJECT_OFFERING_PROTECTED_LESSONS', 'Resolve protected or ongoing lessons before disabling this subject', { lessonSessionIds: sessions.filter(row => !allowed.has(row.id) || row.startsAt < at).map(row => row.id) })
    for (const row of await repositories.subjectEnrollments.list({ classSubjectId: offering.id }))
      await closeSubjectParticipation(repositories, row, at, actor)
    for (const session of sessions) await repositories.lessonSessions.save(session.copyWith({ status: OccurrenceStatus.Cancelled }))
  }
  else {
    for (const placement of await repositories.enrollments.list({ classGroupId: offering.classGroupId }))
      await ensureCompulsoryParticipation(repositories, placement, offering, actor, at)
  }
  await bumpParticipation(repositories, offering.id)
}

export async function reconcileSubjectPolicy(repositories: SchoolRepositories, subject: Subject, previous: Subject | undefined, actor: SchoolScopedActorMetadata): Promise<void> {
  if (!previous || previous.isOptional === subject.isOptional)
    return
  const at = new Date()
  for (const offering of await repositories.classSubjects.list({ subjectId: subject.id })) {
    if (!subject.isOptional && offering.isOffered) {
      for (const placement of await repositories.enrollments.list({ classGroupId: offering.classGroupId }))
        await ensureCompulsoryParticipation(repositories, placement, offering, actor, at)
    }
    await bumpParticipation(repositories, offering.id)
  }
}
