import {
  describe,
  expect,
  test,
} from 'bun:test'
import {
  AcademicPeriod,
  AcademicPeriodType,
  AcademicYear,
  Assessment,
  AssessmentKind,
  AssessmentResult,
  ClassGroup,
  ClassSubject,
  ReportCardDefinition,
  ReportCardResult,
  ReportCardResultStatus,
  Student,
  StudentClassEnrollment,
} from '../../../src/domain'
import { BusinessRuleViolationError } from '../../../src/domain/shared/business-rule-error'
import { AttendanceSummary } from '../../../src/domain/value-objects/attendance-summary'
import { createTestApp } from '../../support/create-test-app'
import { actor } from './managed-entity-test-context'

describe('Entity config delete gates', () => {
  test('blocks deleting an academic year with class groups', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.academicYearRepository.save(new AcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))

    await expect(app.baseService.entities.academicYears.delete('year-1')).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('enrollment direct save rejects capacity bypass and active deletes', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-existing',
      schoolId: 'school',
      firstName: 'Existing',
      lastName: 'Student',
    }))
    await repositories.studentRepository.save(new Student({
      id: 'student-new',
      schoolId: 'school',
      firstName: 'New',
      lastName: 'Student',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-capacity',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
      capacity: 1,
    }))
    const existingEnrollment = new StudentClassEnrollment({
      id: 'enrollment-existing',
      studentId: 'student-existing',
      classGroupId: 'class-capacity',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    })
    await repositories.StudentClassEnrollmentRepository.save(existingEnrollment)

    await expect(app.baseService.entities.enrollments.save(new StudentClassEnrollment({
      id: 'enrollment-new',
      studentId: 'student-new',
      classGroupId: 'class-capacity',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(app.baseService.entities.enrollments.delete(existingEnrollment.id)).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('published report cards and linked assessment results cannot be deleted directly', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))
    await repositories.reportCardDefinitionRepository.save(new ReportCardDefinition({
      id: 'definition-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      gradeScaleId: 'gs-test',
      name: 'Definition',
    }))
    await repositories.reportCardResultRepository.save(new ReportCardResult({
      id: 'report-card-1',
      reportCardDefinitionId: 'definition-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      periodId: 'period-1',
      sectionResults: [],
      attendanceSummary: new AttendanceSummary({
        presentCount: 0,
        absenceCount: 0,
        lateCount: 0,
      }),
      assessmentResultCount: 1,
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2026-04-01T00:00:00Z'),
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.assessmentRepository.save(new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      startsAt: new Date('2026-02-01T09:00:00Z'),
      endsAt: new Date('2026-02-01T10:00:00Z'),
    }))
    await repositories.assessmentResultRepository.save(new AssessmentResult({
      id: 'assessment-result-1',
      studentId: 'student-1',
      assessmentId: 'assessment-1',
      score: 18,
    }))

    await expect(app.baseService.entities.results.delete('report-card-1')).rejects.toBeInstanceOf(BusinessRuleViolationError)
    await expect(app.baseService.entities.assessmentResults.delete('assessment-result-1')).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('academic period preDelete rejects dependent assessments and report cards', async () => {
    const { app, repositories } = createTestApp(actor)
    const period = new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    })
    await repositories.academicPeriodRepository.save(period)
    await repositories.assessmentRepository.save(new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: period.id,
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      startsAt: new Date('2026-02-01T09:00:00Z'),
      endsAt: new Date('2026-02-01T10:00:00Z'),
    }))

    await expect(app.baseService.entities.academicPeriods.delete(period.id)).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})
