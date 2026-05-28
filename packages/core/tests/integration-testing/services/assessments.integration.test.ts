import { describe, expect, it } from 'bun:test'
import {
  AcademicPeriodType,
  AssessmentKind,
  AttendanceStatus,
  DeadlineComplianceStatus,
  EnrollmentEndReason,
  ReportCardDefinitionSectionKind,
  ReportCardResultStatus,
  SessionKind,
} from '../../../src/entities'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('assessment reporting journey', () => {
  it('publishes a report card from scheduled instruction, attendance, and a recorded assessment result', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createAcademicPeriod({
      id: 'term',
      schoolId: 'school',
      academicYearId: 'year',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    const periodDefinition = await app.scheduling.definePeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year',
      label: 'Period 1',
      order: 1,
      startTime: '08:00',
      endTime: '09:00',
    })
    expect(periodDefinition.durationMinutes).toBe(60)
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
    })
    await app.scheduling.createSession({
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await app.scheduling.recordAttendance({
      id: 'attendance',
      studentId: 'student',
      sessionId: 'lesson',
      status: AttendanceStatus.Present,
    })
    await app.assessments.createGradeScale({
      id: 'standard-scale',
      schoolId: 'school',
      name: 'Standard out of 20',
      minScore: 0,
      maxScore: 20,
      ranges: [
        { letter: 'Needs Support', minScore: 0, maxScore: 9.99, isPassing: false },
        { letter: 'Pass', minScore: 10, maxScore: 20, isPassing: true },
      ],
      isDefault: true,
    })
    await app.assessments.createReportCardDefinition({
      id: 'definition',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 Standard',
      isDefault: true,
    })
    await app.assessments.createReportCardDefinitionSection({
      id: 'math-section',
      reportCardDefinitionId: 'definition',
      kind: ReportCardDefinitionSectionKind.Subject,
      name: 'Mathematics',
      order: 1,
      weight: 1,
      subjectId: 'math',
    })
    await app.assessments.createAssessment({
      id: 'quiz',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      periodId: 'term',
      title: 'Fractions quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      sessionId: 'lesson',
    })
    await app.assessments.recordAssessmentResult({ id: 'grade', studentId: 'student', assessmentId: 'quiz', score: 16 })

    const openEntryReview = await app.queries.getAssessmentEntryReview({
      schoolId: 'school',
      assessmentId: 'quiz',
    })
    expect(openEntryReview.assessment.id).toBe('quiz')
    expect(openEntryReview.classSubject.id).toBe(classSubject.id)
    expect(openEntryReview.subject.id).toBe('math')
    expect(openEntryReview.period.id).toBe('term')
    expect(openEntryReview.rows.map(row => row.student.id)).toEqual(['student'])
    expect(openEntryReview.rows[0]?.result?.score).toBe(16)
    expect(openEntryReview.rows[0]?.isLockedByPublishedReportCard).toBe(false)

    const reportCard = await app.assessments.publishReportCardResult({
      id: 'report-card',
      studentId: 'student',
      periodId: 'term',
    })
    expect(reportCard.status).toBe(ReportCardResultStatus.Published)
    expect(reportCard.assessmentResultCount).toBe(1)
    expect(reportCard.overallAverage).toBe(16)
    expect(reportCard.attendanceSummary.presentCount).toBe(1)
    expect(reportCard.sectionResults).toHaveLength(1)
    const detail = await app.queries.getReportCardDetail({
      schoolId: 'school',
      reportCardResultId: reportCard.id,
    })
    expect(detail.reportCard).toEqual(reportCard)
    expect(detail.student.id).toBe('student')
    expect(detail.classGroup.id).toBe('class')
    expect(detail.period.id).toBe('term')
    expect(detail.definition.id).toBe('definition')
    expect(detail.assessmentResults.map(item => item.result.score)).toEqual([16])
    const lockedEntryReview = await app.queries.getAssessmentEntryReview({
      schoolId: 'school',
      assessmentId: 'quiz',
    })
    expect(lockedEntryReview.rows[0]?.isLockedByPublishedReportCard).toBe(true)
    const directory = await app.queries.listStudents({ schoolId: 'school' })
    expect(directory.rows[0]?.latestReportCardResult?.status).toBe(ReportCardResultStatus.Published)

    await expect(app.assessments.recordAssessmentResult({
      id: 'post-publication-score',
      studentId: 'student',
      assessmentId: 'quiz',
      score: 18,
    })).rejects.toThrow('Published report card for student student and period term is immutable')
    await expect(app.assessments.recordAssessmentResultCompliance({
      id: 'post-publication-compliance',
      studentId: 'student',
      assessmentId: 'quiz',
      status: DeadlineComplianceStatus.Met,
    })).rejects.toThrow('Published report card for student student and period term is immutable')
    await expect(app.assessments.generateReportCardResult({
      id: 'regenerated-report-card',
      studentId: 'student',
      periodId: 'term',
    })).rejects.toThrow('Published report card for student student and period term is immutable')
    await expect(app.assessments.publishReportCardResult({
      id: 'republished-report-card',
      studentId: 'student',
      periodId: 'term',
    })).rejects.toThrow('Published report card for student student and period term is immutable')

    await app.students.closeEnrollment({
      enrollmentId: 'enrollment',
      endReason: EnrollmentEndReason.Withdrawn,
      endedAt: new Date('2027-01-01T00:00:00Z'),
    })
    await expect(app.assessments.recordAssessmentResult({
      id: 'post-withdrawal-score',
      studentId: 'student',
      assessmentId: 'quiz',
      score: 18,
    })).rejects.toThrow('does not have an active enrollment')
    await expect(app.assessments.recordAssessmentResultCompliance({
      id: 'post-withdrawal-compliance',
      studentId: 'student',
      assessmentId: 'quiz',
      status: DeadlineComplianceStatus.Met,
    })).rejects.toThrow('does not have an active enrollment')
    const historicalDetail = await app.queries.getReportCardDetail({
      schoolId: 'school',
      reportCardResultId: reportCard.id,
    })
    expect(historicalDetail.reportCard.overallAverage).toBe(16)
    expect(historicalDetail.reportCard.assessmentResultCount).toBe(1)
    expect((await app.queries.getAssessmentEntryReview({ schoolId: 'school', assessmentId: 'quiz' })).rows)
      .toEqual([])
  })
})

describe('assessment lifecycle journey', () => {
  it('completes assessments, tracks deadline compliance, and computes weighted report sections', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createAcademicPeriod({
      id: 'term',
      schoolId: 'school',
      academicYearId: 'year',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
    await app.academics.createSubject({ id: 'language', schoolId: 'school', name: 'Language' })
    const math = await app.academics.offerSubjectToClass({ id: 'class-math', classGroupId: 'class', subjectId: 'math' })
    const language = await app.academics.offerSubjectToClass({
      id: 'class-language',
      classGroupId: 'class',
      subjectId: 'language',
    })
    await app.assessments.createReportCardDefinition({
      id: 'definition',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 Standard',
      isDefault: true,
    })
    await app.assessments.createReportCardDefinitionSection({
      id: 'core',
      reportCardDefinitionId: 'definition',
      kind: ReportCardDefinitionSectionKind.Group,
      name: 'Core Subjects',
      order: 1,
      weight: 1,
    })
    for (const [id, name, subjectId, order, weight] of [
      ['math-section', 'Mathematics', 'math', 1, 2],
      ['language-section', 'Language', 'language', 2, 1],
    ] as const) {
      await app.assessments.createReportCardDefinitionSection({
        id,
        reportCardDefinitionId: 'definition',
        parentSectionId: 'core',
        kind: ReportCardDefinitionSectionKind.Subject,
        name,
        subjectId,
        order,
        weight,
      })
    }
    for (const [id, title, classSubjectId] of [
      ['math-task', 'Mathematics task', math.id],
      ['language-task', 'Language task', language.id],
    ] as const) {
      await app.assessments.createAssessment({
        id,
        classGroupId: 'class',
        classSubjectId,
        periodId: 'term',
        title,
        kind: AssessmentKind.Homework,
        maxScore: 20,
        dueAt: new Date('2026-09-15T23:59:59Z'),
      })
    }
    const completed = await app.assessments.completeAssessment({
      assessmentId: 'math-task',
      metAt: new Date('2026-09-15T20:00:00Z'),
    })
    await app.assessments.recordAssessmentResult({ id: 'math-grade', studentId: 'student', assessmentId: 'math-task', score: 18 })
    const compliance = await app.assessments.recordAssessmentResultCompliance({
      id: 'math-grade-compliance',
      studentId: 'student',
      assessmentId: 'math-task',
      status: DeadlineComplianceStatus.Late,
      notes: 'Submitted after deadline',
    })
    const rescoredMath = await app.assessments.recordAssessmentResult({
      id: 'ignored-replacement-id',
      studentId: 'student',
      assessmentId: 'math-task',
      score: 18,
    })
    await expect(app.assessments.completeAssessment({
      assessmentId: 'math-task',
    })).rejects.toThrow('cannot be changed after results have been recorded')
    await app.assessments.recordAssessmentResult({
      id: 'language-grade',
      studentId: 'student',
      assessmentId: 'language-task',
      score: 12,
    })
    const mathResults = await app.assessments.listClassSubjectAssessmentResultsForPeriod({
      classSubjectId: math.id,
      periodId: 'term',
    })
    const reportCard = await app.assessments.generateReportCardResult({
      id: 'draft-report',
      studentId: 'student',
      periodId: 'term',
    })
    expect(completed.metAt).toEqual(new Date('2026-09-15T20:00:00Z'))
    expect(compliance.score).toBe(18)
    expect(compliance.status).toBe(DeadlineComplianceStatus.Late)
    expect(rescoredMath.status).toBe(DeadlineComplianceStatus.Late)
    expect(rescoredMath.notes).toBe('Submitted after deadline')
    expect(mathResults).toHaveLength(1)
    expect(reportCard.status).toBe(ReportCardResultStatus.Draft)
    expect(reportCard.overallAverage).toBe(16)
    expect(reportCard.sectionResults[0]?.subResults).toHaveLength(2)
  })
})
