import type { AcademicYear, ClassGroup, StudentSubjectEnrollment as Enrollment, School, Student, StudentClassEnrollment, Subject } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { SubjectInvalidationWork, SubjectWork } from './work'
import { BusinessRuleViolationError, ClassSubject, StudentSubjectEnrollment } from '@edaya/core'
import { schoolDayStart } from './dates'
import { hasSubjectDependencies, invalidateSubjectWork, loadSubjectWork } from './work'

export interface ParticipationContext {
  placement: StudentClassEnrollment
  offering: ClassSubject
  year: AcademicYear
  group: ClassGroup
  subject: Subject
  student: Student
  school: School | undefined
}
export async function enrollmentBounds(repositories: SchoolRepositories, placementId: string, classSubjectId: string, context?: ParticipationContext) {
  const [placement, offering] = context ? [context.placement, context.offering] : await Promise.all([repositories.enrollments.findById(placementId), repositories.classSubjects.findById(classSubjectId)])
  if (!placement || !offering || placement.id !== placementId || offering.id !== classSubjectId || placement.classGroupId !== offering.classGroupId)
    throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PLACEMENT_INVALID', 'Subject must belong to the student’s class placement')
  const [year, group, subject, student] = context ? [context.year, context.group, context.subject, context.student] : await Promise.all([repositories.academicYears.findById(placement.academicYearId), repositories.classGroups.findById(placement.classGroupId), repositories.subjects.findById(offering.subjectId), repositories.students.findById(placement.studentId)])
  if (!year || !group || !subject || !student || group.schoolId !== year.schoolId || student.schoolId !== year.schoolId || subject.schoolId !== year.schoolId || subject.academicYearId !== year.id || subject.gradeLevelId !== group.gradeLevelId)
    throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PLACEMENT_INVALID', 'Enrollment references must share a school, grade and academic year')
  const school = context ? context.school : await repositories.schools.findById(group.schoolId)
  const timeZone = school?.timeZone ?? 'UTC'
  const yearStart = schoolDayStart(year.startDate, timeZone)
  const yearEnd = schoolDayStart(year.endDate, timeZone, 1)
  return { placement, offering, year, group, subject, timeZone, start: new Date(Math.max(placement.enrolledAt.getTime(), yearStart.getTime())), end: new Date(Math.min(placement.endedAt?.getTime() ?? Infinity, yearEnd.getTime())) }
}

export async function bumpParticipation(repositories: SchoolRepositories, classSubjectId: string): Promise<void> {
  const offering = await repositories.classSubjects.findById(classSubjectId)
  if (offering)
    await repositories.classSubjects.save(new ClassSubject({ ...offering.data, participationRevision: offering.participationRevision + 1 }))
}

export async function persistSubjectEnrollment(repositories: SchoolRepositories, row: Enrollment, previous?: Enrollment, snapshot?: SubjectInvalidationWork, context?: { bounds: Awaited<ReturnType<typeof enrollmentBounds>>, existing: readonly Enrollment[] }): Promise<void> {
  const bounds = context?.bounds ?? await enrollmentBounds(repositories, row.studentClassEnrollmentId, row.classSubjectId)
  if (bounds.placement.id !== row.studentClassEnrollmentId || bounds.offering.id !== row.classSubjectId)
    throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PLACEMENT_INVALID', 'Participation context does not match the selection')
  if (!row.deletedAt && (row.enrolledAt < bounds.start || !row.endedAt || row.endedAt > bounds.end))
    throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_DATE_INVALID', 'Participation must stay within the class placement and academic year')
  const other = context?.existing ?? await repositories.subjectEnrollments.list({ studentClassEnrollmentId: row.studentClassEnrollmentId, classSubjectId: row.classSubjectId })
  if (!row.deletedAt && other.some(item => item.id !== row.id && !item.deletedAt))
    throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_ALREADY_EXISTS', 'Only one current selection is allowed per subject and placement')
  const work = snapshot ?? await loadSubjectWork(repositories, row.classSubjectId)
  await repositories.subjectEnrollments.save(row)
  await invalidateSubjectWork(repositories, work, bounds.placement.studentId, previous, row)
  await bumpParticipation(repositories, row.classSubjectId)
}

/** Called only under academic-state; no catch-and-delete fallback and no dependent cascades. */
export async function withdrawSubjectEnrollment(repositories: SchoolRepositories, row: Enrollment, actorId: string, at: Date, snapshot?: SubjectWork) {
  if (row.deletedAt)
    return
  const placement = await repositories.enrollments.findById(row.studentClassEnrollmentId)
  if (!placement)
    throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PLACEMENT_INVALID', 'Enrollment placement not found')
  const work = snapshot ?? await loadSubjectWork(repositories, row.classSubjectId)
  if (hasSubjectDependencies(work, placement.studentId))
    await repositories.subjectEnrollments.save(new StudentSubjectEnrollment({ ...row.data, deletedAt: at, deletedBy: actorId, revision: row.revision + 1 }))
  else
    await repositories.subjectEnrollments.delete(row.id)
  await invalidateSubjectWork(repositories, work, placement.studentId, row)
  await bumpParticipation(repositories, row.classSubjectId)
}
