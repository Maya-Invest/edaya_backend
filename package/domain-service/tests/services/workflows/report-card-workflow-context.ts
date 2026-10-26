import type { DocumentRendererPort, NotificationGatewayPort, ReportCardResultInput } from '@edaya/core'
import { AcademicPeriod, AcademicPeriodType, Assessment, AssessmentKind, AssessmentResult, AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus, ClassSubject, GradeLevel, GradeScale, Guardian, GuardianStudentLink, LessonSession, noOpNotificationGateway, ReportCardResult, ReportCardResultStatus, ReportModule, Student, Subject } from '@edaya/core'
import { seedSubjectParticipation } from '../../support/seed-subject-participation'
import { createStudentTransitionContext } from './student-workflow-context'

export async function createReportCardContext({ existingReportCard, notificationGateway = noOpNotificationGateway, academicPeriodPublished = true, marksApproved = true, documentRenderer }: { documentRenderer?: DocumentRendererPort, existingReportCard?: Partial<ReportCardResultInput> & { id: string }, notificationGateway?: NotificationGatewayPort, academicPeriodPublished?: boolean, marksApproved?: boolean } = {}) {
  const fixture = await createStudentTransitionContext({ notificationGateway, documentRenderer })
  const { repositories } = fixture
  for (const id of ['per1', 'per-t1', 'per-unpublished']) await repositories.academicPeriods.save(new AcademicPeriod({ id, schoolId: 'sch1', academicYearId: 'ay1', name: id, type: AcademicPeriodType.Trimester, isPublished: academicPeriodPublished && id !== 'per-unpublished', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') }))
  await repositories.reportModules.save(new ReportModule({ id: 'sec-root', schoolId: 'sch1', gradeLevelId: 'grade1', academicYearId: 'ay1', name: 'Academics', order: 1 }))
  await repositories.subjects.save(new Subject({ gradeLevelId: 'grade1', academicYearId: 'ay1', id: 'subject-math', schoolId: 'sch1', name: 'Math', coefficient: 1, reportModuleId: 'sec-root' }))
  await repositories.classSubjects.save(new ClassSubject({ id: 'cs1', classGroupId: 'cg1', subjectId: 'subject-math', coefficient: 1, isOffered: true, completedPercentage: 0 }))
  await repositories.gradeScales.save(new GradeScale({ id: 'grade-scale', schoolId: 'sch1', name: '20 points', minScore: 0, maxScore: 20, ranges: [{ id: 'pass', letter: 'A', interpretation: 'Pass', minScore: 0, maxScore: 20 }], intervalConvention: 'continuous' }))
  const level = (await repositories.gradeLevels.findById('grade1'))!
  const scale = (await repositories.gradeScales.findById('grade-scale'))!
  await repositories.gradeLevels.save(new GradeLevel({ ...level.data, gradingPolicies: [{ academicYearId: 'ay1', revision: 1, mode: 'numeric-first', aggregateLabel: 'Average', status: 'completed', scale: { ...scale.data, ranges: [...scale.ranges] } }] }))
  await repositories.assessments.save(new Assessment({ id: 'ass1', marksStatus: marksApproved ? 'submitted' : 'draft', marksReview: marksApproved ? { rosterStudentIds: ['stu1'], submittedBy: 'fixture-teacher' } : {}, classGroupId: 'cg1', classSubjectId: 'cs1', periodId: 'per1', title: 'Math test', kind: AssessmentKind.Quiz, maxScore: 100, coefficient: 1, startsAt: new Date('2026-02-01T09:00:00Z'), endsAt: new Date('2026-02-01T10:00:00Z') }))
  await repositories.assessmentResults.save(new AssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 80 }))
  for (const [index, status] of [AttendanceStatus.Present, AttendanceStatus.Absent, AttendanceStatus.Late].entries()) {
    const startsAt = new Date(`2026-02-0${index + 1}T09:00:00Z`)
    await repositories.lessonSessions.save(new LessonSession({ id: `session-${index}`, schoolId: 'sch1', classGroupId: 'cg1', classSubjectId: 'cs1', displayLabel: 'Math', startsAt, endsAt: new Date(startsAt.getTime() + 3600000) }))
    await repositories.attendance.save(new AttendanceRecord({ id: `attendance-${index}`, studentId: 'stu1', lessonSessionId: `session-${index}`, status, date: startsAt, ...(status === AttendanceStatus.Absent ? { justificationStatus: AttendanceJustificationStatus.Excused, justifiedByStaffId: 'user1', justifiedAt: startsAt } : {}) }))
  }
  const student = (await repositories.students.findById('stu1'))!
  await repositories.students.save(new Student({ ...student.data, subjectId: 'subject-stu1' }))
  await repositories.guardians.save(new Guardian({ id: 'gua1', schoolId: 'sch1', firstName: 'Grace', lastName: 'Hopper', subjectId: 'subject-gua1' }))
  await repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link', schoolId: 'sch1', studentId: 'stu1', guardianId: 'gua1', receivesAcademicReports: true }))
  if (existingReportCard)
    await repositories.results.save(new ReportCardResult({ gradeLevelId: 'grade1', academicYearId: 'ay1', reportConfigurationRevision: 0, studentId: 'stu1', classGroupId: 'cg1', periodId: 'per1', assessmentResultCount: 0, sectionResults: [], attendanceSummary: { presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 }, ...(existingReportCard.status === ReportCardResultStatus.Published ? { publishedAt: new Date('2026-04-01') } : {}), ...existingReportCard }))
  await seedSubjectParticipation(repositories)
  return { ...fixture, results: repositories.results }
}
