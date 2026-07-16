import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
} from '@edaya/authorization'
import { AcademicPeriod, AcademicPeriodType, AcademicYear, Announcement, AnnouncementTarget, AnnouncementTargetKind, Assessment, AssessmentKind, AssessmentResult, AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus, AttendanceSummary, BusinessRuleViolationError, ClassGroup, ClassSubject, ClassSubjectProgress, EnrollmentEndReason, Fee, FeeStatus, GradeLevel, GradeScale, Incident, IncidentKind, IncidentStatus, LessonSession, OccurrenceStatus, Payment, PaymentMethod, PaymentStatus, ReportCardDefinition, ReportCardDefinitionSection, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultStatus, Resource, ResourceAssignment, ResourceKind, School, StaffMember, Student, StudentClassEnrollment, StudentClassEnrollmentStatus, StudentDisciplinaryAction, StudentDisciplinaryActionStatus, StudentFee, Subject, SubjectCategory, SubjectColor } from '@edaya/core'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { effectiveGrantsForRoles } from '../../support/effective-grants'
import { actor } from './managed-entity-test-context'

describe('Entity config save gates', () => {
  test('allows progress-only updates on inherited class subjects with periodsPerWeek', async () => {
    const { app, repositories } = createTestApp(actor)
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
    const { app } = createTestApp(actor)

    await expect(app.baseService.entities.classSubjectProgress.save(new ClassSubjectProgress({
      id: 'progress-orphan',
      classSubjectMatterId: 'missing-matter',
      lessonSessionId: 'missing-lesson-session',
      completedPercentage: 10,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('assessment config preSave rejects duplicate default grade scales', async () => {
    const { app, repositories } = createTestApp(actor)
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
    const { app, repositories } = createTestApp(actor)
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
    const { app, repositories } = createTestApp(actor)
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
    const { app, repositories } = createTestApp(actor)
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
    const { app, repositories } = createTestApp(actor)
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
    const { app, repositories } = createTestApp(actor)
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

  test('assessment preSave rejects completion after results are recorded', async () => {
    const { app, repositories } = createTestApp(actor)
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
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('enrollment preSave rejects closing an enrollment that is not current active', async () => {
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
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'schedule-1',
      classSubjectId: 'class-subject-1',
      displayLabel: 'Math',
      startsAt: new Date('2026-05-01T08:00:00Z'),
      endsAt: new Date('2026-05-01T09:00:00Z'),
    }))
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
      justifiedByStaffId: 'staff-1',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('student fee preSave rejects invalid adjustments and paid cancellation', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    const studentFee = new StudentFee({
      id: 'student-fee-1',
      studentId: 'student-1',
      feeId: 'fee-1',
      academicYearId: 'year-1',
      expectedAmount: 100,
      paidAmount: 80,
      currency: 'XAF',
      status: FeeStatus.Partial,
    })
    await repositories.studentFeeRepository.save(studentFee)

    await expect(app.baseService.entities.studentFees.save(studentFee.copyWith({
      adjustmentAmount: 30,
      adjustmentReason: 'Discount',
      adjustedById: 'staff-1',
      adjustedAt: new Date('2026-05-01T00:00:00Z'),
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(app.baseService.entities.studentFees.save(studentFee.copyWith({
      status: FeeStatus.Cancelled,
      cancellationReason: 'Cancelled',
      cancelledById: 'staff-1',
      cancelledAt: new Date('2026-05-01T00:00:00Z'),
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('incident preSave rejects invalid scope and non-open resolution', async () => {
    const { app, repositories } = createTestApp(actor)
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
    const { app, repositories } = createTestApp(actor)
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

  test('setup preSave rejects staff self-deactivation through managed save', async () => {
    const staffActor = createStaffActorMetadata({
      subjectId: 'staff-user',
      staffMemberId: 'staff-1',
      schoolId: 'school',
      effectiveGrants: effectiveGrantsForRoles(['admin']),
      requestId: 'request',
      authenticatedAt: new Date('2026-05-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    })
    const { app, repositories } = createTestApp(staffActor)
    const staffMember = new StaffMember({
      id: 'staff-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Admin',
    })
    await repositories.staffMemberRepository.save(staffMember)

    await expect(app.baseService.entities.staffMembers.save(new StaffMember({
      id: staffMember.id,
      schoolId: staffMember.schoolId,
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      isActive: false,
      createdAt: staffMember.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('setup preSave rejects school owner deactivation and delete', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
      ownerSubjectId: 'subject-owner',
    }))
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
      createdAt: owner.createdAt,
    }))).rejects.toThrow('Transfer school ownership before deactivating the owner')

    await expect(app.baseService.entities.staffMembers.delete(owner.id))
      .rejects
      .toThrow('Transfer school ownership before deleting the owner')
  })

  test('resource assignment preSave rejects overlapping lesson session assignments', async () => {
    const { app, repositories } = createTestApp(actor)
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
      scheduleId: 'schedule-1',
      classSubjectId: 'class-subject-1',
      displayLabel: 'Math',
      startsAt: new Date('2026-05-01T08:00:00Z'),
      endsAt: new Date('2026-05-01T09:00:00Z'),
    }))
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-2',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'schedule-2',
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
    const { app, repositories } = createTestApp(actor)
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
      order: 1,
    }))

    await expect(app.baseService.entities.announcementTargets.save(new AnnouncementTarget({
      id: 'target-1',
      announcementId: 'announcement-1',
      targetKind: AnnouncementTargetKind.GradeLevel,
      targetId: 'grade-other',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('fee preSave rejects academic years outside the fee school', async () => {
    const { app, repositories } = createTestApp(actor)
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

    await expect(app.baseService.entities.fees.save(new Fee({
      id: 'fee-1',
      schoolId: 'school',
      academicYearId: 'year-other',
      name: 'Tuition',
      defaultAmount: 1000,
      currency: 'USD',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('payment preSave rejects cancelled student fees and terminal payment transitions', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.studentFeeRepository.save(new StudentFee({
      id: 'student-fee-cancelled',
      studentId: 'student-1',
      feeId: 'fee-1',
      academicYearId: 'year-1',
      expectedAmount: 1000,
      currency: 'USD',
      status: FeeStatus.Cancelled,
      cancellationReason: 'waived',
      cancelledById: 'staff-1',
      cancelledAt: new Date('2026-02-01T00:00:00Z'),
    }))

    await expect(app.baseService.entities.payments.save(new Payment({
      id: 'payment-new',
      studentFeeId: 'student-fee-cancelled',
      amount: 100,
      currency: 'USD',
      paymentDate: new Date('2026-02-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await repositories.studentFeeRepository.save(new StudentFee({
      id: 'student-fee-active',
      studentId: 'student-1',
      feeId: 'fee-1',
      academicYearId: 'year-1',
      expectedAmount: 1000,
      currency: 'USD',
      status: FeeStatus.Pending,
    }))
    const reversed = new Payment({
      id: 'payment-reversed',
      studentFeeId: 'student-fee-active',
      amount: 100,
      currency: 'USD',
      paymentDate: new Date('2026-02-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      status: PaymentStatus.Reversed,
      reversedAt: new Date('2026-02-02T00:00:00Z'),
      reversedById: 'staff-1',
    })
    await repositories.paymentRepository.save(reversed)

    await expect(app.baseService.entities.payments.save(new Payment({
      id: reversed.id,
      studentFeeId: reversed.studentFeeId,
      amount: reversed.amount.amount,
      currency: reversed.amount.currency,
      paymentDate: reversed.paymentDate,
      method: reversed.method,
      status: PaymentStatus.Cancelled,
      cancelledAt: new Date('2026-02-03T00:00:00Z'),
      cancelledById: 'staff-1',
      createdAt: reversed.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('report-card result preSave rejects direct edits to published cards', async () => {
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
