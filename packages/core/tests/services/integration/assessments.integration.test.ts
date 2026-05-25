import { describe, expect, it } from 'bun:test'
import {
  AcademicPeriodType,
  AssessmentKind,
  AttendanceStatus,
  DeadlineComplianceStatus,
  ReportCardDefinitionSectionKind,
  ReportCardResultStatus,
  SessionKind,
} from '../../../src/entities'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('assessment reporting journey', () => {
  it('publishes a report card from scheduled instruction, attendance, and a recorded grade', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
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
    const groupedSession = await app.scheduling.createGroupedSession({
      id: 'assembly',
      schoolId: 'school',
      academicYearId: 'year',
      academicPeriodId: 'term',
      title: 'Term opening',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T07:30:00Z'),
      endsAt: new Date('2026-09-01T08:00:00Z'),
    })
    expect(periodDefinition.durationMinutes).toBe(60)
    expect(groupedSession.academicPeriodId).toBe('term')
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
    await app.assessments.recordGrade({ id: 'grade', studentId: 'student', assessmentId: 'quiz', score: 16 })

    const reportCard = await app.assessments.publishReportCardResult({
      id: 'report-card',
      studentId: 'student',
      periodId: 'term',
    })
    expect(reportCard.status).toBe(ReportCardResultStatus.Published)
    expect(reportCard.gradeCount).toBe(1)
    expect(reportCard.overallAverage).toBe(16)
    expect(reportCard.attendanceSummary.presentCount).toBe(1)
    expect(reportCard.sectionResults).toHaveLength(1)
    const directory = await app.queries.listStudents({ schoolId: 'school' })
    expect(directory.rows[0]?.latestReportCardResult?.status).toBe(ReportCardResultStatus.Published)
  })
})

describe('assessment lifecycle journey', () => {
  it('completes assessments, tracks deadline compliance, and computes weighted report sections', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
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
      weight: 1,
    })
    for (const [id, name, subjectId, weight] of [
      ['math-section', 'Mathematics', 'math', 2],
      ['language-section', 'Language', 'language', 1],
    ] as const) {
      await app.assessments.createReportCardDefinitionSection({
        id,
        reportCardDefinitionId: 'definition',
        parentSectionId: 'core',
        kind: ReportCardDefinitionSectionKind.Subject,
        name,
        subjectId,
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
    await app.assessments.recordGrade({ id: 'math-grade', studentId: 'student', assessmentId: 'math-task', score: 18 })
    const compliance = await app.assessments.recordGradeCompliance({
      id: 'math-grade-compliance',
      studentId: 'student',
      assessmentId: 'math-task',
      status: DeadlineComplianceStatus.Late,
    })
    await app.assessments.recordGrade({
      id: 'language-grade',
      studentId: 'student',
      assessmentId: 'language-task',
      score: 12,
    })
    const mathGrades = await app.assessments.listClassSubjectGradesForPeriod({
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
    expect(mathGrades).toHaveLength(1)
    expect(reportCard.status).toBe(ReportCardResultStatus.Draft)
    expect(reportCard.overallAverage).toBe(16)
    expect(reportCard.sectionResults[0]?.subResults).toHaveLength(2)
  })
})
