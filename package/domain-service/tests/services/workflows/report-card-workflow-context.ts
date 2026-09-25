import type { NotificationGatewayPort, ReportCardResultInput } from '@edaya/core'
import { AcademicPeriod, AcademicPeriodType, Assessment, AssessmentKind, AssessmentResult, AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus, ClassSubject, GradeScale, Guardian, GuardianStudentLink, LessonSession, noOpNotificationGateway, ReportCardDefinition, ReportCardDefinitionSection, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultStatus, Student, Subject } from '@edaya/core'
import { createStudentTransitionContext } from './student-workflow-context'

export async function createReportCardContext({ existingReportCard, notificationGateway = noOpNotificationGateway, academicPeriodPublished = true, marksApproved = true }: { existingReportCard?: Partial<ReportCardResultInput> & { id: string }, notificationGateway?: NotificationGatewayPort, academicPeriodPublished?: boolean, marksApproved?: boolean } = {}) {
  const fixture = await createStudentTransitionContext({ notificationGateway })
  const { repositories } = fixture
  for (const id of ['per1', 'per-t1', 'per-unpublished']) await repositories.academicPeriods.save(new AcademicPeriod({ id, schoolId: 'sch1', academicYearId: 'ay1', name: id, type: AcademicPeriodType.Trimester, isPublished: academicPeriodPublished && id !== 'per-unpublished', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') }))
  await repositories.subjects.save(new Subject({ id: 'subject-math', schoolId: 'sch1', name: 'Math' }))
  await repositories.classSubjects.save(new ClassSubject({ id: 'cs1', classGroupId: 'cg1', subjectId: 'subject-math', coefficient: 1, isOffered: true, completedPercentage: 0 }))
  await repositories.gradeScales.save(new GradeScale({ id: 'grade-scale', schoolId: 'sch1', name: '20 points', minScore: 0, maxScore: 20, ranges: [{ letter: 'A', minScore: 16, maxScore: 20, isPassing: true }] }))
  await repositories.definitions.save(new ReportCardDefinition({ id: 'def1', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', gradeScaleId: 'grade-scale', name: 'Report' }))
  await repositories.sections.save(new ReportCardDefinitionSection({ id: 'sec-root', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Group, name: 'Academics', order: 1, weight: 1 }))
  await repositories.sections.save(new ReportCardDefinitionSection({ id: 'sec-math', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Subject, name: 'Math', order: 1, weight: 1, parentSectionId: 'sec-root', subjectId: 'subject-math' }))
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
    await repositories.results.save(new ReportCardResult({ reportCardDefinitionId: 'def1', studentId: 'stu1', classGroupId: 'cg1', periodId: 'per1', assessmentResultCount: 0, sectionResults: [], attendanceSummary: { presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 }, ...(existingReportCard.status === ReportCardResultStatus.Published ? { publishedAt: new Date('2026-04-01') } : {}), ...existingReportCard }))
  return { ...fixture, results: repositories.results }
}
