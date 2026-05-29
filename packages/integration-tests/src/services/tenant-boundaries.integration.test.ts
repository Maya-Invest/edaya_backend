import { describe, expect, it } from 'bun:test'
import {
  AcademicPeriodType,
  AnnouncementTargetKind,
  AssessmentKind,
  AttachmentOwnerKind,
  AttendanceJustificationStatus,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  DisciplinaryActionKind,
  IncidentInvolvementRole,
  IncidentKind,
  PaymentMethod,
  ResourceKind,
  SessionKind,
  StaffMember,
  StaffRole,
  StudentNoteVisibility,
  StudentStatus,
  ActorAssuranceLevel,
  AuthorizationErrorCode,
  createStaffActorMetadata,
} from '@edaya/core'
import { createTestApp } from '../support/in-memory-school-headless-app'

describe('tenant boundary safeguards', () => {
  it('rejects cross-school setup, staffing, curriculum, and communications references', async () => {
    const { app, forActor, repositories } = createTestApp(createStaffActorMetadata({
      subjectId: 'school-a-admin-user',
      staffMemberId: 'school-a-admin',
      schoolId: 'school-a',
      roles: [StaffRole.Admin],
      requestId: 'school-a-setup',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))
    const schoolBApp = forActor(createStaffActorMetadata({
      subjectId: 'school-b-admin-user',
      staffMemberId: 'school-b-admin',
      schoolId: 'school-b',
      roles: [StaffRole.Admin],
      requestId: 'school-b-setup',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))
    await repositories.staffMemberRepository.save(new StaffMember({
      id: 'school-b-admin',
      schoolId: 'school-b',
      firstName: 'School B',
      lastName: 'Administrator',
      roles: [StaffRole.Admin],
    }))
    await app.setup.registerSchool({ id: 'school-a', name: 'School A', timeZone: 'UTC' })
    await schoolBApp.setup.registerSchool({ id: 'school-b', name: 'School B', timeZone: 'UTC' })
    await app.setup.createAcademicYear({
      id: 'year-a',
      schoolId: 'school-a',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level-a', schoolId: 'school-a', name: 'Grade 6', order: 6 })
    await schoolBApp.setup.createAcademicYear({
      id: 'year-b',
      schoolId: 'school-b',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await schoolBApp.setup.createAcademicPeriod({
      id: 'term-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await schoolBApp.setup.createGradeLevel({ id: 'level-b', schoolId: 'school-b', name: 'Grade 6', order: 6 })
    await expect(app.setup.updateSchoolConfiguration({
      schoolId: 'school-b',
      name: 'Foreign school update',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.setup.activateAcademicYear({ academicYearId: 'year-b' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.setup.publishAcademicPeriod({ academicPeriodId: 'term-b' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.setup.createAcademicPeriod({
      id: 'invalid-term',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      name: 'Too early',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })).rejects.toThrow('must fit within academic year')
    await expect(app.setup.createClassGroup({
      id: 'invalid-class',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      gradeLevelId: 'level-b',
      name: 'Invalid class',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await app.setup.createClassGroup({
      id: 'class-a',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      gradeLevelId: 'level-a',
      name: 'Grade 6 A',
    })
    await app.academics.createSubject({ id: 'subject-a', schoolId: 'school-a', name: 'Local subject' })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-subject-a',
      classGroupId: 'class-a',
      subjectId: 'subject-a',
    })
    await expect(app.scheduling.createSession({
      id: 'invalid-school-session',
      schoolId: 'school-b',
      classGroupId: 'class-a',
      title: 'Cross-school session',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await schoolBApp.setup.createClassGroup({
      id: 'class-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      gradeLevelId: 'level-b',
      name: 'Grade 6 B',
    })
    await expect(app.setup.updateClassGroupConfiguration({
      classGroupId: 'class-b',
      capacity: 10,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await schoolBApp.scheduling.createCalendarEvent({
      id: 'calendar-event-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      title: 'Outside closure',
      startDate: new Date('2026-09-02T00:00:00Z'),
      endDate: new Date('2026-09-02T23:59:59Z'),
      kind: CalendarEventKind.Holiday,
      isNonSchoolDay: true,
    })
    await expect(app.scheduling.createCalendarEvent({
      id: 'foreign-year-event',
      schoolId: 'school-a',
      academicYearId: 'year-b',
      title: 'Foreign year',
      startDate: new Date('2026-09-02T00:00:00Z'),
      endDate: new Date('2026-09-02T23:59:59Z'),
      kind: CalendarEventKind.Event,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.scheduling.createCalendarEvent({
      id: 'foreign-grade-event',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      title: 'Foreign grade',
      startDate: new Date('2026-09-02T00:00:00Z'),
      endDate: new Date('2026-09-02T23:59:59Z'),
      kind: CalendarEventKind.Event,
      scopeKind: CalendarEventScopeKind.GradeLevel,
      scopeId: 'level-b',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.scheduling.createCalendarEvent({
      id: 'foreign-class-event',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      title: 'Foreign class',
      startDate: new Date('2026-09-02T00:00:00Z'),
      endDate: new Date('2026-09-02T23:59:59Z'),
      kind: CalendarEventKind.Event,
      scopeKind: CalendarEventScopeKind.ClassGroup,
      scopeId: 'class-b',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await schoolBApp.students.registerStudent({
      id: 'student-b',
      schoolId: 'school-b',
      firstName: 'Outside',
      lastName: 'Student',
    })
    await schoolBApp.students.enrollStudent({
      id: 'enrollment-b',
      studentId: 'student-b',
      classGroupId: 'class-b',
    })
    await schoolBApp.students.registerGuardian({
      id: 'guardian-b',
      schoolId: 'school-b',
      firstName: 'Outside',
      lastName: 'Guardian',
    })
    await schoolBApp.students.linkGuardianToStudent({
      id: 'guardian-link-b',
      guardianId: 'guardian-b',
      studentId: 'student-b',
    })
    await schoolBApp.students.createStudentNote({
      id: 'student-note-b',
      studentId: 'student-b',
      body: 'Foreign note.',
      visibility: StudentNoteVisibility.Staff,
    })
    const sessionB = await schoolBApp.scheduling.createSession({
      id: 'session-b',
      schoolId: 'school-b',
      classGroupId: 'class-b',
      title: 'Outside attendance',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await schoolBApp.scheduling.recordAttendance({
      id: 'attendance-b',
      studentId: 'student-b',
      sessionId: sessionB.id,
      status: AttendanceStatus.Absent,
    })
    const actionB = await schoolBApp.behavior.createDisciplinaryAction({
      id: 'action-b',
      schoolId: 'school-b',
      name: 'Outside action',
      kind: DisciplinaryActionKind.Sanction,
    })
    const incidentB = await schoolBApp.behavior.recordIncident({
      id: 'incident-b',
      schoolId: 'school-b',
      classGroupId: 'class-b',
      sessionId: sessionB.id,
      title: 'Outside incident',
      description: 'Foreign school incident.',
      date: new Date('2026-09-01T08:30:00Z'),
      kind: IncidentKind.MinorInfraction,
    })
    await schoolBApp.behavior.addStudentInvolvement({
      id: 'involvement-b',
      incidentId: incidentB.id,
      studentId: 'student-b',
      role: IncidentInvolvementRole.Subject,
    })
    await schoolBApp.behavior.applyDisciplinaryAction({
      id: 'applied-action-b',
      incidentId: incidentB.id,
      studentId: 'student-b',
      disciplinaryActionId: actionB.id,
    })
    await schoolBApp.finance.createFee({
      id: 'fee-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      name: 'Outside fee',
      defaultAmount: 10000,
      currency: 'XAF',
    })
    const studentFeeB = await schoolBApp.finance.assignFeeToStudent({
      id: 'student-fee-b',
      studentId: 'student-b',
      feeId: 'fee-b',
    })
    await schoolBApp.finance.recordPayment({
      id: 'payment-b',
      studentFeeId: studentFeeB.id,
      amount: 1000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    await schoolBApp.setup.createResource({
      id: 'resource-b',
      schoolId: 'school-b',
      name: 'Outside room',
      kind: ResourceKind.Location,
    })
    await schoolBApp.setup.assignResourceToSession({
      id: 'resource-session-b',
      resourceId: 'resource-b',
      sessionId: sessionB.id,
    })
    await schoolBApp.setup.registerAttachment({
      id: 'attachment-b',
      schoolId: 'school-b',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-b',
      fileName: 'outside.pdf',
      fileUrl: 'https://files.example.test/outside.pdf',
    })
    await schoolBApp.assessments.createReportCardDefinition({
      id: 'definition-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      gradeLevelId: 'level-b',
      name: 'School B Report Card',
      isDefault: true,
    })
    await schoolBApp.assessments.publishReportCardResult({
      id: 'report-card-b',
      studentId: 'student-b',
      periodId: 'term-b',
    })
    await schoolBApp.setup.registerStaffMember({
      id: 'staff-b',
      schoolId: 'school-b',
      firstName: 'Outside',
      lastName: 'Teacher',
      roles: [StaffRole.Teacher],
    })
    await expect(app.setup.updateStaffMemberStatus({ staffId: 'staff-b', isActive: false }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.setup.assignStaffToClass({
      id: 'invalid-assignment',
      staffId: 'staff-b',
      classGroupId: 'class-a',
      role: StaffRole.Teacher,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const classGroupId of ['missing-class', 'class-b']) {
      await expect(app.setup.assignStaffToClass({
        id: `probe-${classGroupId}`,
        staffId: 'staff-b',
        classGroupId,
        role: StaffRole.Teacher,
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await app.communications.createAnnouncement({
      id: 'school-a-announcement',
      schoolId: 'school-a',
      title: 'School A announcement',
      content: 'Visible within School A only.',
    })
    await expect(app.communications.addTarget({
      id: 'invalid-target',
      announcementId: 'school-a-announcement',
      targetKind: AnnouncementTargetKind.StaffMember,
      targetId: 'staff-b',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await schoolBApp.academics.createSubject({ id: 'subject-b', schoolId: 'school-b', name: 'Outside subject' })
    const classSubjectB = await schoolBApp.academics.offerSubjectToClass({
      id: 'class-subject-b',
      classGroupId: 'class-b',
      subjectId: 'subject-b',
    })
    await schoolBApp.assessments.createAssessment({
      id: 'assessment-b',
      classGroupId: 'class-b',
      classSubjectId: classSubjectB.id,
      periodId: 'term-b',
      title: 'Outside assessment',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      dueAt: new Date('2026-09-15T00:00:00Z'),
    })
    await expect(app.academics.offerSubjectToClass({
      id: 'invalid-course',
      classGroupId: 'class-a',
      subjectId: 'subject-b',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    for (const sessionId of ['missing-session', sessionB.id]) {
      await expect(app.scheduling.reviewAttendanceJustification({
        studentId: 'student-b',
        sessionId,
        decision: AttendanceJustificationStatus.Excused,
        reason: 'Cross-school review probe',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(app.setup.assignResourceToSession({
      id: 'foreign-resource-assignment',
      resourceId: 'resource-b',
      sessionId: sessionB.id,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.queries.resources.list({ schoolId: 'school-b' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const incidentId of ['missing-incident', incidentB.id]) {
      await expect(app.behavior.addStudentInvolvement({
        id: `probe-${incidentId}`,
        incidentId,
        studentId: 'student-b',
        role: IncidentInvolvementRole.Subject,
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(app.behavior.resolveIncident({ incidentId }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(app.behavior.applyDisciplinaryAction({
      id: 'foreign-applied-action',
      incidentId: incidentB.id,
      studentId: 'student-b',
      disciplinaryActionId: actionB.id,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const subjectId of ['missing-subject', 'subject-b']) {
      await expect(app.academics.createSubjectMatter({
        id: `probe-${subjectId}`,
        subjectId,
        name: 'Probe matter',
        sequenceOrder: 1,
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await schoolBApp.communications.createAnnouncement({
      id: 'school-b-announcement',
      schoolId: 'school-b',
      title: 'School B announcement',
      content: 'Not visible within School A.',
    })
    await schoolBApp.communications.addTarget({
      id: 'school-b-target',
      announcementId: 'school-b-announcement',
      targetKind: AnnouncementTargetKind.School,
    })
    for (const announcementId of ['missing-announcement', 'school-b-announcement']) {
      await expect(app.communications.publishAnnouncement({ announcementId }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(app.queries.announcements.list({ schoolId: 'school-b' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const studentFeeId of ['missing-student-fee', 'student-fee-b']) {
      await expect(app.finance.adjustStudentFee({
        studentFeeId,
        adjustmentAmount: 1000,
        reason: 'Probe adjustment',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(app.finance.cancelStudentFee({
        studentFeeId,
        reason: 'Probe cancellation',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    for (const paymentId of ['missing-payment', 'payment-b']) {
      await expect(app.finance.cancelPayment({ paymentId }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    for (const studentId of ['missing-student', 'student-b']) {
      await expect(app.students.updateStudentProfile({
        studentId,
        firstName: 'Probe',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(app.students.updateStudentStatus({
        studentId,
        status: StudentStatus.Inactive,
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(app.students.upsertStudentHealthProfile({
        id: `probe-health-${studentId}`,
        studentId,
        allergies: 'Probe allergy',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(app.students.createStudentNote({
        id: `probe-note-${studentId}`,
        studentId,
        body: 'Probe note',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(app.students.updateStudentNote({
      noteId: 'student-note-b',
      body: 'Probe update',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.students.updateGuardianContactMethods({
      guardianId: 'guardian-b',
      firstName: 'Probe',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.students.updateGuardianStudentLink({
      guardianId: 'guardian-b',
      studentId: 'student-b',
      isBillingContact: true,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.setup.registerAttachment({
      id: 'foreign-attachment',
      schoolId: 'school-a',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-b',
      fileName: 'foreign.pdf',
      fileUrl: 'https://files.example.test/foreign.pdf',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    for (const periodId of ['missing-term', 'term-b']) {
      await expect(app.assessments.listClassSubjectAssessmentResultsForPeriod({
        classSubjectId: classSubject.id,
        periodId,
      }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
  })
})
