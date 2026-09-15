import { ActorAssuranceLevel, AuthorizationErrorCode, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicPeriodType, AnnouncementTargetKind, AssessmentKind, Attachment, AttachmentOwnerKind, AttendanceJustificationStatus, AttendanceStatus, CalendarEventKind, CalendarEventScopeKind, DisciplinaryAction, DisciplinaryActionKind, GradeLevel, GradeScale, IncidentInvolvementRole, IncidentKind, PaymentMethod, Resource, ResourceKind, School, StaffMember, StudentNoteVisibility, StudentStatus, Subject, SubjectMatter } from '@edaya/core'
import { createAttachmentUpload } from '@edaya/service'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import {
  adjustStudentFee,
  cancelStudentFee,
  createAcademicPeriod,
  createClassGroup,
  listClassSubjectAssessmentResultsForPeriod,
  publishAcademicPeriod,
  resolveIncident,
  reviewAttendanceJustification,
  saveAnnouncement,
  saveAnnouncementTarget,
  saveAssessment,
  saveCalendarEvent,
  saveClassSubject,
  saveFee,
  saveGuardian,
  saveIncident,
  saveLessonSession,
  saveReportCardDefinition,
  saveResourceAssignment,
  saveSchool,
  saveStaffAssignment,
  saveStaffMember,
  saveStudent,
  saveStudentHealthProfileForStudent,
  saveStudentNote,
  updateClassGroup,
  updateGuardian,
  updateGuardianStudentLink,
  updateSchool,
  updateStaffStatus,
  updateStudent,
  updateStudentNote,
} from '../utils/core-service-helpers'
import { createTestApp } from '../utils/test-adapter'

describeIntegration('tenant boundary safeguards', () => {
  it('rejects cross-school setup, staffing, curriculum, and communications references', async () => {
    const { app, forActor, repositories } = await createTestApp(createStaffActorMetadata({
      subjectId: 'school-a-admin-user',
      staffMemberId: 'school-a-admin',
      schoolId: 'school-a',
      requestId: 'school-a-setup',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))
    const schoolBApp = forActor(createStaffActorMetadata({
      subjectId: 'school-b-admin-user',
      staffMemberId: 'school-b-admin',
      schoolId: 'school-b',
      requestId: 'school-b-setup',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))
    await repositories.staffMemberRepository.save(new StaffMember({
      id: 'school-b-admin',
      schoolId: 'school-b',
      firstName: 'School B',
      lastName: 'Administrator',
      subjectId: 'school-b-admin-user',
    }))
    await repositories.schoolRepository.save(new School({ id: 'school-a', name: 'School A', timeZone: 'UTC', ownerSubjectId: 'school-a-admin-user' }))
    await repositories.schoolRepository.save(new School({ id: 'school-b', name: 'School B', timeZone: 'UTC', ownerSubjectId: 'school-b-admin-user' }))
    await saveSchool(app, { id: 'school-a', name: 'School A', timeZone: 'UTC' })
    await saveSchool(schoolBApp, { id: 'school-b', name: 'School B', timeZone: 'UTC' })
    await app.setupWorkflow.createAcademicYear({
      id: 'year-a',
      schoolId: 'school-a',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.baseService.entities.gradeLevels.save(
      new GradeLevel({ id: 'level-a', schoolId: 'school-a', name: 'Grade 6', label: 'G6', order: 6 }),
    )
    await schoolBApp.setupWorkflow.createAcademicYear({
      id: 'year-b',
      schoolId: 'school-b',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await createAcademicPeriod(schoolBApp, {
      id: 'term-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await schoolBApp.baseService.entities.gradeLevels.save(
      new GradeLevel({ id: 'level-b', schoolId: 'school-b', name: 'Grade 6', label: 'G6', order: 6 }),
    )
    await expect(updateSchool(app, {
      schoolId: 'school-b',
      name: 'Foreign school update',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.setupWorkflow.publishAcademicYear({ academicYearId: 'year-b' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(publishAcademicPeriod(app, 'term-b'))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(createAcademicPeriod(app, {
      id: 'invalid-term',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      name: 'Too early',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })).rejects.toThrow('must fit within academic year')
    await expect(createClassGroup(app, {
      id: 'invalid-class',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      gradeLevelId: 'level-b',
      name: 'Invalid class',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await createClassGroup(app, {
      id: 'class-a',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      gradeLevelId: 'level-a',
      name: 'Grade 6 A',
    })
    await app.baseService.entities.subjects.save(
      new Subject({ id: 'subject-a', schoolId: 'school-a', name: 'Local subject' }),
    )
    const classSubject = await saveClassSubject(app, {
      id: 'class-subject-a',
      classGroupId: 'class-a',
      subjectId: 'subject-a',
      gradeLevelSubjectId: 'gls-subject-a',
    })
    await createClassGroup(schoolBApp, {
      id: 'class-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      gradeLevelId: 'level-b',
      name: 'Grade 6 B',
    })
    await schoolBApp.baseService.entities.subjects.save(
      new Subject({ id: 'subject-b', schoolId: 'school-b', name: 'Outside subject' }),
    )
    const classSubjectB = await saveClassSubject(schoolBApp, {
      id: 'class-subject-b',
      classGroupId: 'class-b',
      subjectId: 'subject-b',
      gradeLevelSubjectId: 'gls-subject-b',
    })
    await expect(saveLessonSession(app, {
      id: 'invalid-school-session',
      classGroupId: 'class-b',
      classSubjectId: classSubject.id,
      displayLabel: 'Cross-school session',
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(updateClassGroup(app, {
      classGroupId: 'class-b',
      capacity: 10,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await saveCalendarEvent(schoolBApp, {
      id: 'calendar-event-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      title: 'Outside closure',
      startDate: new Date('2026-09-02T00:00:00Z'),
      endDate: new Date('2026-09-02T23:59:59Z'),
      kind: CalendarEventKind.Holiday,
      isNonSchoolDay: true,
    })
    await expect(saveCalendarEvent(app, {
      id: 'foreign-year-event',
      schoolId: 'school-a',
      academicYearId: 'year-b',
      title: 'Foreign year',
      startDate: new Date('2026-09-02T00:00:00Z'),
      endDate: new Date('2026-09-02T23:59:59Z'),
      kind: CalendarEventKind.Event,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(saveCalendarEvent(app, {
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
    await expect(saveCalendarEvent(app, {
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
    await saveStudent(schoolBApp, {
      id: 'student-b',
      schoolId: 'school-b',
      firstName: 'Outside',
      lastName: 'Student',
    })
    await schoolBApp.studentWorkflow.enrollStudent({
      id: 'enrollment-b',
      studentId: 'student-b',
      classGroupId: 'class-b',
    })
    await saveGuardian(schoolBApp, {
      id: 'guardian-b',
      schoolId: 'school-b',
      firstName: 'Outside',
      lastName: 'Guardian',
    })
    await schoolBApp.studentWorkflow.linkGuardianToStudent({
      id: 'guardian-link-b',
      guardianId: 'guardian-b',
      studentId: 'student-b',
    })
    await saveStudentNote(schoolBApp, {
      id: 'student-note-b',
      studentId: 'student-b',
      body: 'Foreign note.',
      visibility: StudentNoteVisibility.Staff,
    })
    const sessionB = await saveLessonSession(schoolBApp, {
      id: 'session-b',
      schoolId: 'school-b',
      classGroupId: 'class-b',
      classSubjectId: classSubjectB.id,
      displayLabel: 'Outside attendance',
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await schoolBApp.schedulingWorkflow.recordAttendance({
      id: 'attendance-b',
      studentId: 'student-b',
      lessonSessionId: sessionB.id,
      status: AttendanceStatus.Absent,
    })
    const actionB = new DisciplinaryAction({
      id: 'action-b',
      schoolId: 'school-b',
      name: 'Outside action',
      kind: DisciplinaryActionKind.Sanction,
    })
    await schoolBApp.baseService.entities.disciplinaryActions.save(actionB)
    const incidentB = await saveIncident(schoolBApp, {
      id: 'incident-b',
      schoolId: 'school-b',
      classGroupId: 'class-b',
      lessonSessionId: sessionB.id,
      title: 'Outside incident',
      description: 'Foreign school incident.',
      date: new Date('2026-09-01T08:30:00Z'),
      kind: IncidentKind.MinorInfraction,
    })
    await schoolBApp.behaviorWorkflow.addStudentInvolvement({
      id: 'involvement-b',
      incidentId: incidentB.id,
      studentId: 'student-b',
      role: IncidentInvolvementRole.Subject,
    })
    await schoolBApp.behaviorWorkflow.applyDisciplinaryAction({
      id: 'applied-action-b',
      incidentId: incidentB.id,
      studentId: 'student-b',
      disciplinaryActionId: actionB.id,
    })
    await saveFee(schoolBApp, {
      id: 'fee-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      name: 'Outside fee',
      defaultAmount: 10000,
      currency: 'XAF',
    })
    await schoolBApp.financeWorkflow.enrollStudentInService({
      id: 'student-fee-b',
      studentId: 'student-b',
      catalogServiceId: 'fee-b',
    })
    await schoolBApp.financeWorkflow.recordPayment({
      id: 'payment-b',
      studentId: 'student-b',
      academicYearId: 'year-b',
      amount: 1000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      allocation: { mode: 'fifo' },
    })
    await schoolBApp.baseService.entities.resources.save(
      new Resource({
        id: 'resource-b',
        schoolId: 'school-b',
        name: 'Outside room',
        kind: ResourceKind.Location,
      }),
    )
    await saveResourceAssignment(schoolBApp, {
      id: 'resource-session-b',
      resourceId: 'resource-b',
      lessonSessionId: sessionB.id,
    })
    await repositories.attachmentRepository.save(new Attachment({
      id: 'attachment-b',
      schoolId: 'school-b',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-b',
      fileName: 'outside.pdf',
      fileUrl: 'https://files.example.test/outside.pdf',
    }))
    await schoolBApp.baseService.entities.gradeScales.save(new GradeScale({
      id: 'gs-b',
      schoolId: 'school-b',
      name: 'Standard',
      minScore: 0,
      maxScore: 20,
      ranges: [{ letter: 'A', minScore: 0, maxScore: 20, isPassing: true }],
    }))
    await saveReportCardDefinition(schoolBApp, {
      id: 'definition-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      gradeLevelId: 'level-b',
      gradeScaleId: 'gs-b',
      name: 'School B Report Card',
      isDefault: true,
    })
    await publishAcademicPeriod(schoolBApp, 'term-b')
    await schoolBApp.assessmentsWorkflow.publishReportCardResult({
      id: 'report-card-b',
      studentId: 'student-b',
      periodId: 'term-b',
    })
    await saveStaffMember(schoolBApp, {
      id: 'staff-b',
      schoolId: 'school-b',
      firstName: 'Outside',
      lastName: 'Teacher',
    })
    await expect(updateStaffStatus(app, 'staff-b', false))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(saveStaffAssignment(app, {
      id: 'invalid-assignment',
      staffId: 'staff-b',
      academicYearId: 'year-a',
      classGroupId: 'class-a',
      responsibility: 'teacher',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const classGroupId of ['missing-class', 'class-b']) {
      await expect(saveStaffAssignment(app, {
        id: `probe-${classGroupId}`,
        staffId: 'staff-b',
        academicYearId: 'year-a',
        classGroupId,
        responsibility: 'teacher',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await saveAnnouncement(app, {
      id: 'school-a-announcement',
      schoolId: 'school-a',
      title: 'School A announcement',
      content: 'Visible within School A only.',
    })
    await expect(saveAnnouncementTarget(app, {
      id: 'invalid-target',
      announcementId: 'school-a-announcement',
      targetKind: AnnouncementTargetKind.StaffMember,
      targetId: 'staff-b',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await schoolBApp.baseService.entities.subjects.save(
      new Subject({ id: 'subject-b-assessment', schoolId: 'school-b', name: 'Assessment subject' }),
    )
    const classSubjectBForAssessment = await saveClassSubject(schoolBApp, {
      id: 'class-subject-b-assessment',
      classGroupId: 'class-b',
      subjectId: 'subject-b-assessment',
      gradeLevelSubjectId: 'gls-subject-b-assessment',
    })
    await saveAssessment(schoolBApp, {
      id: 'assessment-b',
      classGroupId: 'class-b',
      classSubjectId: classSubjectBForAssessment.id,
      periodId: 'term-b',
      title: 'Outside assessment',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      startsAt: new Date('2026-09-15T09:00:00Z'),
      endsAt: new Date('2026-09-15T10:00:00Z'),
    })
    await expect(saveClassSubject(app, {
      id: 'invalid-course',
      classGroupId: 'class-a',
      subjectId: 'subject-b',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    for (const lessonSessionId of ['missing-session', sessionB.id]) {
      await expect(reviewAttendanceJustification(app, {
        studentId: 'student-b',
        lessonSessionId,
        decision: AttendanceJustificationStatus.Excused,
        reason: 'Cross-school review probe',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(saveResourceAssignment(app, {
      id: 'foreign-resource-assignment',
      resourceId: 'resource-b',
      lessonSessionId: sessionB.id,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.baseService.entities.resources.list({ schoolId: 'school-b' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const incidentId of ['missing-incident', incidentB.id]) {
      await expect(app.behaviorWorkflow.addStudentInvolvement({
        id: `probe-${incidentId}`,
        incidentId,
        studentId: 'student-b',
        role: IncidentInvolvementRole.Subject,
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(resolveIncident(app, incidentId))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(app.behaviorWorkflow.applyDisciplinaryAction({
      id: 'foreign-applied-action',
      incidentId: incidentB.id,
      studentId: 'student-b',
      disciplinaryActionId: actionB.id,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const subjectId of ['missing-subject', 'subject-b']) {
      await expect(app.baseService.entities.subjectMatters.save(
        new SubjectMatter({
          id: `probe-${subjectId}`,
          subjectId,
          name: 'Probe matter',
          sequenceOrder: 1,
        }),
      )).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await saveAnnouncement(schoolBApp, {
      id: 'school-b-announcement',
      schoolId: 'school-b',
      title: 'School B announcement',
      content: 'Not visible within School A.',
    })
    await saveAnnouncementTarget(schoolBApp, {
      id: 'school-b-target',
      announcementId: 'school-b-announcement',
      targetKind: AnnouncementTargetKind.School,
    })
    for (const announcementId of ['missing-announcement', 'school-b-announcement']) {
      await expect(app.communicationsWorkflow.publishAnnouncement({ announcementId }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(app.baseService.entities.announcements.list({ schoolId: 'school-b' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const studentFeeId of ['missing-student-fee', 'student-fee-b']) {
      await expect(adjustStudentFee(app, {
        studentFeeId,
        adjustmentAmount: 1000,
        reason: 'Probe adjustment',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(cancelStudentFee(app, {
        studentFeeId,
        reason: 'Probe cancellation',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    for (const paymentId of ['missing-payment', 'payment-b']) {
      await expect(app.financeWorkflow.reversePayment({ paymentId }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    for (const studentId of ['missing-student', 'student-b']) {
      await expect(updateStudent(app, {
        studentId,
        firstName: 'Probe',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(updateStudent(app, {
        studentId,
        status: StudentStatus.Inactive,
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(saveStudentHealthProfileForStudent(app, {
        id: `probe-health-${studentId}`,
        studentId,
        allergies: 'Probe allergy',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(saveStudentNote(app, {
        id: `probe-note-${studentId}`,
        studentId,
        body: 'Probe note',
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(updateStudentNote(app, {
      noteId: 'student-note-b',
      body: 'Probe update',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(updateGuardian(app, {
      guardianId: 'guardian-b',
      firstName: 'Probe',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(updateGuardianStudentLink(app, {
      guardianId: 'guardian-b',
      studentId: 'student-b',
      isBillingContact: true,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(createAttachmentUpload(app.baseService, {
      attachmentId: 'foreign-attachment',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-b',
      fileName: 'foreign.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 64,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    for (const periodId of ['missing-term', 'term-b']) {
      await expect(listClassSubjectAssessmentResultsForPeriod(app, {
        classSubjectId: classSubject.id,
        periodId,
      }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
  })
})
