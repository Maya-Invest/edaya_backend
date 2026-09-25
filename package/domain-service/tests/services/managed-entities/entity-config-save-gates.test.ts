import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
} from '@edaya/authorization'
import { AcademicPeriod, AcademicPeriodType, AcademicYear, Announcement, AnnouncementTarget, AnnouncementTargetKind, Assessment, AssessmentKind, AssessmentResult, AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus, AttendanceSummary, BusinessRuleViolationError, CatalogService, CatalogServiceStatus, ChargeStatus, ClassGroup, ClassSubject, ClassSubjectProgress, DisciplinaryAction, EnrollmentEndReason, GradeLevel, GradeLevelSubject, GradeScale, Incident, IncidentInvolvementRole, IncidentKind, IncidentStatus, LessonSession, OccurrenceStatus, Payment, PaymentKind, PaymentMethod, PaymentStatus, Permission, ReportCardDefinition, ReportCardDefinitionSection, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultStatus, Resource, ResourceAssignment, ResourceKind, School, StaffMember, StaffPermissionAssignment, Student, StudentCharge, StudentClassEnrollment, StudentClassEnrollmentStatus, StudentDisciplinaryAction, StudentDisciplinaryActionStatus, StudentIncidentInvolvement, StudentYearAccount, studentYearAccountId, Subject, SubjectCategory, SubjectColor } from '@edaya/core'
import { validateStudentChargeSave } from '@edaya/service'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createAcademicTestApp } from './academic-test-app'

describe('Entity config save gates', () => {
  test('allows progress-only updates on inherited class subjects with periodsPerWeek', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.subjectRepository.save(new Subject({
      id: 'subject-1',
      schoolId: 'school',
      name: 'French',
      category: SubjectCategory.Literary,
      color: SubjectColor.Warm,
    }))
    await app.baseService.repositories.gradeLevelSubjects.save(new GradeLevelSubject({ id: 'grade-subject-1', gradeLevelId: 'grade-1', academicYearId: 'year-1', subjectId: 'subject-1', coefficient: 3, periodsPerWeek: 4 }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
      gradeLevelSubjectId: 'grade-subject-1',
      coefficient: 3,
      periodsPerWeek: 4,
      completedPercentage: 0,
    }))

    const updated = await app.baseService.entities.classSubjects.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
      gradeLevelSubjectId: 'grade-subject-1',
      coefficient: 3,
      periodsPerWeek: 4,
      completedPercentage: 25,
    }))
    expect(updated).toBeUndefined()
    expect((await repositories.classSubjectRepository.findById('class-subject-1'))?.completedPercentage).toBe(25)
  })

  test('rejects orphan class subject progress before save', async () => {
    const { app } = await createAcademicTestApp()

    await expect(app.baseService.entities.classSubjectProgress.save(new ClassSubjectProgress({
      id: 'progress-orphan',
      classSubjectMatterId: 'missing-matter',
      lessonSessionId: 'missing-lesson-session',
      completedPercentage: 10,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('assessment config preSave rejects duplicate default grade scales', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
    }))
    await repositories.gradeScaleRepository.save(new GradeScale({
      id: 'scale-existing',
      schoolId: 'school',
      name: 'Default',
      minScore: 0,
      maxScore: 100,
      ranges: [{ letter: 'A', minScore: 0, maxScore: 100, isPassing: true }],
      isDefault: true,
    }))

    await expect(app.baseService.entities.gradeScales.save(new GradeScale({
      id: 'scale-new',
      schoolId: 'school',
      name: 'Other default',
      minScore: 0,
      maxScore: 100,
      ranges: [{ letter: 'A', minScore: 0, maxScore: 100, isPassing: true }],
      isDefault: true,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('report-card definition preSave rejects invalid resources and duplicate defaults', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
    }))
    await repositories.academicYearRepository.save(new AcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    }))
    await repositories.gradeLevelRepository.save(new GradeLevel({
      id: 'grade-1',
      schoolId: 'school',
      name: 'Grade 1',
      label: 'G1',
      order: 1,
    }))
    await repositories.gradeScaleRepository.save(new GradeScale({
      id: 'gs-test',
      schoolId: 'school',
      name: 'Test scale',
      minScore: 0,
      maxScore: 20,
      ranges: [{ letter: 'A', minScore: 0, maxScore: 20, isPassing: true }],
    }))
    await repositories.reportCardDefinitionRepository.save(new ReportCardDefinition({
      id: 'definition-existing',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      gradeScaleId: 'gs-test',
      name: 'Default',
      isDefault: true,
    }))

    await expect(app.baseService.entities.definitions.save(new ReportCardDefinition({
      id: 'definition-missing-year',
      schoolId: 'school',
      academicYearId: 'missing-year',
      gradeLevelId: 'grade-1',
      gradeScaleId: 'gs-test',
      name: 'Invalid',
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await expect(app.baseService.entities.definitions.save(new ReportCardDefinition({
      id: 'definition-new',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      gradeScaleId: 'gs-test',
      name: 'Other default',
      isDefault: true,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('report-card section preSave rejects invalid parent relationships', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
    }))
    await repositories.reportCardDefinitionRepository.save(new ReportCardDefinition({
      id: 'definition-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      gradeScaleId: 'gs-test',
      name: 'Definition',
    }))

    await expect(app.baseService.entities.sections.save(new ReportCardDefinitionSection({
      id: 'section-self',
      reportCardDefinitionId: 'definition-1',
      name: 'Self',
      order: 1,
      weight: 1,
      parentSectionId: 'section-self',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await repositories.reportCardDefinitionSectionRepository.save(new ReportCardDefinitionSection({
      id: 'section-subject-parent',
      reportCardDefinitionId: 'definition-1',
      kind: ReportCardDefinitionSectionKind.Subject,
      name: 'Math',
      order: 1,
      weight: 1,
      subjectId: 'subject-1',
    }))
    await expect(app.baseService.entities.sections.save(new ReportCardDefinitionSection({
      id: 'section-child',
      reportCardDefinitionId: 'definition-1',
      name: 'Child',
      order: 2,
      weight: 1,
      parentSectionId: 'section-subject-parent',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    const child = new ReportCardDefinitionSection({
      id: 'section-cycle-child',
      reportCardDefinitionId: 'definition-1',
      name: 'Cycle child',
      order: 3,
      weight: 1,
    })
    await repositories.reportCardDefinitionSectionRepository.save(child)
    await repositories.reportCardDefinitionSectionRepository.save(new ReportCardDefinitionSection({
      id: 'section-cycle-parent',
      reportCardDefinitionId: 'definition-1',
      name: 'Cycle parent',
      order: 4,
      weight: 1,
      parentSectionId: child.id,
    }))
    await expect(app.baseService.entities.sections.save(child.copyWith({
      parentSectionId: 'section-cycle-parent',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('assessment preSave rejects inconsistent class subject, period, and lesson session references', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-2',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'schedule-1',
      classSubjectId: 'other-class-subject',
      displayLabel: 'Other subject',
      startsAt: new Date('2026-02-01T08:00:00Z'),
      endsAt: new Date('2026-02-01T09:00:00Z'),
    }))

    await expect(app.baseService.entities.assessments.save(new Assessment({
      id: 'assessment-bad-period',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      startsAt: new Date('2026-02-01T09:00:00Z'),
      endsAt: new Date('2026-02-01T10:00:00Z'),
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-valid',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))

    await expect(app.baseService.entities.assessments.save(new Assessment({
      id: 'assessment-bad-lesson-session',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-valid',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      lessonSessionId: 'session-1',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('assessment preSave rejects class subjects that are not offered', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
      isOffered: false,
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

    await expect(app.baseService.entities.assessments.save(new Assessment({
      id: 'assessment-not-offered',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      startsAt: new Date('2026-02-01T09:00:00Z'),
      endsAt: new Date('2026-02-01T10:00:00Z'),
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('assessment preSave rejects self-timed overlap when schedule conflict enforcement is enabled', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
      enforceScheduleConflicts: true,
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
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
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'ls-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'sch-1',
      classSubjectId: 'class-subject-1',
      status: OccurrenceStatus.Pending,
      startsAt: new Date('2026-02-01T09:00:00Z'),
      endsAt: new Date('2026-02-01T10:00:00Z'),
      displayLabel: 'Math',
    }))

    await expect(app.baseService.entities.assessments.save(new Assessment({
      id: 'assessment-conflict',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      startsAt: new Date('2026-02-01T09:00:00Z'),
      endsAt: new Date('2026-02-01T10:00:00Z'),
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('assessment preSave allows completion without submitting marks after results are recorded', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
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
    const assessment = new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Homework 1',
      kind: AssessmentKind.Homework,
      maxScore: 20,
      dueAt: new Date('2026-02-01T00:00:00Z'),
    })
    await repositories.assessmentRepository.save(assessment)
    await repositories.assessmentResultRepository.save(new AssessmentResult({
      id: 'assessment-result-1',
      studentId: 'student-1',
      assessmentId: assessment.id,
      score: 18,
    }))

    await expect(app.baseService.entities.assessments.save(new Assessment({
      id: assessment.id,
      classGroupId: assessment.classGroupId,
      classSubjectId: assessment.classSubjectId,
      periodId: assessment.periodId,
      title: assessment.title,
      kind: assessment.kind,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      dueAt: assessment.dueAt,
      completedAt: new Date('2026-02-02T00:00:00Z'),
      createdAt: assessment.createdAt,
    }))).resolves.toBeUndefined()
  })

  test('enrollment preSave rejects closing an enrollment that is not current active', async () => {
    const { app, repositories } = await createAcademicTestApp()
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
    await repositories.StudentClassEnrollmentRepository.save(new StudentClassEnrollment({
      id: 'enrollment-current',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    }))
    const staleEnrollment = new StudentClassEnrollment({
      id: 'enrollment-stale',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 2,
    })
    await repositories.StudentClassEnrollmentRepository.save(staleEnrollment)

    await expect(app.baseService.entities.enrollments.save(new StudentClassEnrollment({
      id: staleEnrollment.id,
      studentId: staleEnrollment.studentId,
      classGroupId: staleEnrollment.classGroupId,
      academicYearId: staleEnrollment.academicYearId,
      enrollmentIndex: staleEnrollment.enrollmentIndex,
      status: StudentClassEnrollmentStatus.Closed,
      enrolledAt: staleEnrollment.enrolledAt,
      endedAt: new Date(staleEnrollment.enrolledAt.getTime() + 86_400_000),
      endReason: EnrollmentEndReason.Withdrawn,
      closedBy: 'system',
      createdAt: staleEnrollment.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('attendance preSave rejects reviewing non-absent attendance', async () => {
    const { app, repositories } = await createAcademicTestApp()
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
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      displayLabel: 'Math',
      startsAt: new Date('2026-05-01T08:00:00Z'),
      endsAt: new Date('2026-05-01T09:00:00Z'),
    }))
    await repositories.StudentClassEnrollmentRepository.save(new StudentClassEnrollment({ id: 'enrollment-1', studentId: 'student-1', classGroupId: 'class-1', academicYearId: 'year-1', enrollmentIndex: 1 }))
    const attendance = new AttendanceRecord({
      id: 'attendance-1',
      studentId: 'student-1',
      lessonSessionId: 'session-1',
      date: new Date('2026-05-01T08:00:00Z'),
      status: AttendanceStatus.Late,
    })
    await repositories.attendanceRepository.save(attendance)

    await expect(app.baseService.entities.attendance.save(attendance.copyWith({
      justificationStatus: AttendanceJustificationStatus.Excused,
      reason: 'Medical',
      justifiedAt: new Date('2026-05-02T08:00:00Z'),
      justifiedByStaffId: 'staff-test',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('student charge preSave rejects invalid adjustments and paid cancellation', async () => {
    const { repositories, schoolRepositories } = await createAcademicTestApp()
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    const charge = new StudentCharge({
      id: 'student-fee-1',
      schoolId: 'school',
      studentId: 'student-1',
      enrollmentId: 'enr-1',
      academicYearId: 'year-1',
      label: 'Tuition',
      expectedAmount: 100,
      allocatedAmount: 80,
      currency: 'XAF',
      status: ChargeStatus.Partial,
    })
    await repositories.studentChargeRepository.save(charge)

    await expect(validateStudentChargeSave(charge.copyWith({
      adjustmentAmount: 30,
      adjustmentReason: 'Discount',
      adjustedById: 'staff-1',
      adjustedAt: new Date('2026-05-01T00:00:00Z'),
    }), charge, schoolRepositories)).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(validateStudentChargeSave(charge.copyWith({
      status: ChargeStatus.Cancelled,
      cancellationReason: 'Cancelled',
      cancelledById: 'staff-1',
      cancelledAt: new Date('2026-05-01T00:00:00Z'),
    }), charge, schoolRepositories)).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('incident preSave rejects invalid scope and non-open resolution', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await expect(app.baseService.entities.incidents.save(new Incident({
      id: 'incident-invalid-scope',
      schoolId: 'school',
      title: 'Incident',
      description: 'Description',
      date: new Date('2026-05-01T00:00:00Z'),
      kind: IncidentKind.MinorInfraction,
      reporterId: 'staff-1',
      classGroupId: 'missing-class',
    }))).rejects.toBeInstanceOf(AuthorizationError)

    const cancelledIncident = new Incident({
      id: 'incident-cancelled',
      schoolId: 'school',
      title: 'Incident',
      description: 'Description',
      date: new Date('2026-05-01T00:00:00Z'),
      kind: IncidentKind.MinorInfraction,
      reporterId: 'staff-1',
      status: IncidentStatus.Cancelled,
    })
    await repositories.incidentRepository.save(cancelledIncident)

    await expect(app.baseService.entities.incidents.save(new Incident({
      id: cancelledIncident.id,
      schoolId: cancelledIncident.schoolId,
      title: cancelledIncident.title,
      description: cancelledIncident.description,
      date: cancelledIncident.date,
      kind: cancelledIncident.kind,
      reporterId: cancelledIncident.reporterId,
      status: IncidentStatus.Resolved,
      resolvedAt: new Date('2026-05-02T00:00:00Z'),
      resolvedByStaffId: 'staff-1',
      createdAt: cancelledIncident.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('student disciplinary action preSave rejects terminal status changes', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.studentRepository.save(new Student({ id: 'student-1', schoolId: 'school', firstName: 'Student', lastName: 'One' }))
    await repositories.staffMemberRepository.save(new StaffMember({ id: 'staff-1', schoolId: 'school', firstName: 'Staff', lastName: 'One' }))
    await repositories.incidentRepository.save(new Incident({ id: 'incident-1', schoolId: 'school', title: 'Incident', description: 'Description', date: new Date('2026-05-01'), kind: IncidentKind.MinorInfraction, reporterId: 'staff-1', classGroupId: 'class-1' }))
    await repositories.disciplinaryActionRepository.save(new DisciplinaryAction({ id: 'catalog-1', schoolId: 'school', name: 'Sanction' }))
    await repositories.studentIncidentInvolvementRepository.save(new StudentIncidentInvolvement({ id: 'involvement-1', incidentId: 'incident-1', studentId: 'student-1', role: IncidentInvolvementRole.Subject }))
    const completedAction = new StudentDisciplinaryAction({
      id: 'disciplinary-action-1',
      schoolId: 'school',
      incidentId: 'incident-1',
      studentId: 'student-1',
      disciplinaryActionId: 'catalog-1',
      assignedByStaffId: 'staff-1',
      status: StudentDisciplinaryActionStatus.Completed,
    })
    await repositories.studentDisciplinaryActionRepository.save(completedAction)

    await expect(app.baseService.entities.studentDisciplinaryActions.save(new StudentDisciplinaryAction({
      id: completedAction.id,
      schoolId: completedAction.schoolId,
      incidentId: completedAction.incidentId,
      studentId: completedAction.studentId,
      disciplinaryActionId: completedAction.disciplinaryActionId,
      assignedByStaffId: completedAction.assignedByStaffId,
      status: StudentDisciplinaryActionStatus.Cancelled,
      createdAt: completedAction.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('staff policy rejects self-deactivation and deletion through managed entities', async () => {
    const staffActor = createStaffActorMetadata({
      subjectId: 'staff-user',
      staffMemberId: 'staff-1',
      schoolId: 'school',
      requestId: 'request',
      authenticatedAt: new Date('2026-05-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    })
    const { app, repositories, schoolRepositories } = await createTestApp(staffActor)
    await schoolRepositories.academicYears.save(new AcademicYear({ id: 'archive-year', schoolId: 'school', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
    await schoolRepositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'archive', schoolId: 'school', academicYearId: 'archive-year', staffId: staffActor.staffMemberId, permission: Permission.STAFF_ARCHIVE, scopes: [{ kind: 'school' }] }))
    const staffMember = new StaffMember({
      id: 'staff-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Admin',
      subjectId: staffActor.subjectId,
    })
    await repositories.staffMemberRepository.save(staffMember)

    await expect(app.baseService.entities.staffMembers.save(new StaffMember({
      id: staffMember.id,
      schoolId: staffMember.schoolId,
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      isActive: false,
      subjectId: staffActor.subjectId,
      createdAt: staffMember.createdAt,
    }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(app.baseService.entities.staffMembers.delete(staffMember.id)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('setup preSave rejects school owner deactivation and delete', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
      ownerSubjectId: 'subject-owner',
    }))
    await app.baseService.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'archive-owner', schoolId: 'school', academicYearId: 'year-1', staffId: 'staff-test', permission: Permission.STAFF_ARCHIVE, scopes: [{ kind: 'school' }] }))
    const owner = new StaffMember({
      id: 'owner',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Owner',
      subjectId: 'subject-owner',
    })
    await repositories.staffMemberRepository.save(owner)

    await expect(app.baseService.entities.staffMembers.save(new StaffMember({
      id: owner.id,
      schoolId: owner.schoolId,
      firstName: owner.firstName,
      lastName: owner.lastName,
      isActive: false,
      subjectId: owner.subjectId,
      createdAt: owner.createdAt,
    }))).rejects.toThrow('Transfer school ownership before deactivating the owner')

    await expect(app.baseService.entities.staffMembers.delete(owner.id))
      .rejects
      .toThrow('Transfer school ownership before deleting the owner')
  })

  test('resource assignment preSave rejects overlapping lesson session assignments', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.resourceRepository.save(new Resource({
      id: 'resource-1',
      schoolId: 'school',
      name: 'Room A',
      kind: ResourceKind.Location,
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      displayLabel: 'Math',
      startsAt: new Date('2026-05-01T08:00:00Z'),
      endsAt: new Date('2026-05-01T09:00:00Z'),
    }))
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-2',
      schoolId: 'school',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      displayLabel: 'Science',
      startsAt: new Date('2026-05-01T08:30:00Z'),
      endsAt: new Date('2026-05-01T09:30:00Z'),
    }))
    await repositories.resourceAssignmentRepository.save(new ResourceAssignment({
      id: 'assignment-existing',
      resourceId: 'resource-1',
      lessonSessionId: 'session-1',
    }))

    await expect(app.baseService.entities.resourceAssignments.save(new ResourceAssignment({
      id: 'assignment-new',
      resourceId: 'resource-1',
      lessonSessionId: 'session-2',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('assessment result preSave rejects writes after report card is published', async () => {
    const { app, repositories } = await createAcademicTestApp()
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
    await repositories.StudentClassEnrollmentRepository.save(new StudentClassEnrollment({
      id: 'enrollment-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
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
    await repositories.reportCardResultRepository.save(new ReportCardResult({
      id: 'report-card-1',
      reportCardDefinitionId: 'definition-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      periodId: 'period-1',
      sectionResults: [],
      attendanceSummary: new AttendanceSummary({ presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 }),
      assessmentResultCount: 0,
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2026-03-31T00:00:00Z'),
    }))

    await expect(app.baseService.entities.assessmentResults.save(new AssessmentResult({
      id: 'assessment-result-1',
      studentId: 'student-1',
      assessmentId: 'assessment-1',
      score: 18,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('announcement target preSave rejects targets outside announcement school', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.announcementRepository.save(new Announcement({
      id: 'announcement-1',
      schoolId: 'school',
      title: 'Notice',
      content: 'Hello',
      createdBy: 'system',
    }))
    await repositories.gradeLevelRepository.save(new GradeLevel({
      id: 'grade-other',
      schoolId: 'other-school',
      name: 'Other Grade',
      label: 'Other',
      order: 1,
    }))

    await expect(app.baseService.entities.announcementTargets.save(new AnnouncementTarget({
      id: 'target-1',
      announcementId: 'announcement-1',
      targetKind: AnnouncementTargetKind.GradeLevel,
      targetId: 'grade-other',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('catalog service preSave rejects academic years outside the school', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
    }))
    await repositories.academicYearRepository.save(new AcademicYear({
      id: 'year-other',
      schoolId: 'other-school',
      name: '2026',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    }))

    await expect(app.baseService.entities.catalogServices.save(new CatalogService({
      id: 'fee-1',
      schoolId: 'school',
      academicYearId: 'year-other',
      name: 'Tuition',
      defaultPrice: 1000,
      currency: 'USD',
      billingTerms: { kind: 'one_time', installments: [] },
      status: CatalogServiceStatus.Draft,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('payment preSave rejects missing accounts and terminal payment transitions', async () => {
    const { app, repositories } = await createAcademicTestApp()
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    const accountId = studentYearAccountId('school', 'student-1', 'year-1', 'USD')

    await expect(app.baseService.entities.payments.save(new Payment({
      id: 'payment-new',
      schoolId: 'school',
      accountId,
      academicYearId: 'year-1',
      kind: PaymentKind.Receipt,
      amount: 100,
      currency: 'USD',
      paymentDate: new Date('2026-02-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await repositories.studentYearAccountRepository.save(new StudentYearAccount({
      id: accountId,
      schoolId: 'school',
      studentId: 'student-1',
      academicYearId: 'year-1',
      currency: 'USD',
      availableBalance: 100,
    }))
    const reversed = new Payment({
      id: 'payment-reversed',
      schoolId: 'school',
      accountId,
      academicYearId: 'year-1',
      kind: PaymentKind.Receipt,
      amount: 100,
      currency: 'USD',
      paymentDate: new Date('2026-02-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      status: PaymentStatus.Reversed,
      reversedAt: new Date('2026-02-02T00:00:00Z'),
      reversedById: 'staff-1',
    })
    await repositories.paymentRepository.save(reversed)

    await expect(app.baseService.entities.payments.save(reversed.copyWith({
      reversedByPaymentId: 'other-payment',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('report-card result preSave rejects direct edits to published cards', async () => {
    const { app, repositories } = await createAcademicTestApp()
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
    const published = new ReportCardResult({
      id: 'report-card-1',
      reportCardDefinitionId: 'definition-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      periodId: 'period-1',
      sectionResults: [],
      attendanceSummary: new AttendanceSummary({ presentCount: 0, absenceCount: 0, lateCount: 0 }),
      assessmentResultCount: 0,
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2026-03-31T00:00:00Z'),
    })
    await repositories.reportCardResultRepository.save(published)

    await expect(app.baseService.entities.results.save(new ReportCardResult({
      id: published.id,
      reportCardDefinitionId: published.reportCardDefinitionId,
      studentId: published.studentId,
      classGroupId: published.classGroupId,
      periodId: published.periodId,
      sectionResults: [...published.sectionResults],
      attendanceSummary: published.attendanceSummary,
      assessmentResultCount: 1,
      status: ReportCardResultStatus.Published,
      generatedAt: published.generatedAt,
      publishedAt: published.publishedAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})

describe('SchoolService managed config entity access', () => {
})
