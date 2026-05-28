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
  Guardian,
  IncidentInvolvementRole,
  IncidentKind,
  MessageDeliveryChannel,
  PaymentMethod,
  ResourceKind,
  SessionKind,
  StaffMember,
  StaffRole,
  Student,
  StudentHealthProfile,
  StudentNote,
  StudentNoteVisibility,
  StudentStatus,
} from '../../../src/entities'
import {
  AuthorizationErrorCode,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
} from '../../../src/services/authorization'
import { createTestApp } from '../../support/in-memory-school-headless-app'

async function createAuthorizedFixture() {
  const { app, repositories, forActor } = createTestApp()
  await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
  await app.setup.createAcademicYear({
    id: 'year',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T00:00:00Z'),
  })
  await app.setup.createAcademicPeriod({
    id: 'term',
    schoolId: 'school',
    academicYearId: 'year',
    name: 'Trimester 1',
    type: AcademicPeriodType.Trimester,
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2026-12-31T00:00:00Z'),
  })
  await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
  await app.setup.createClassGroup({
    id: 'class',
    schoolId: 'school',
    academicYearId: 'year',
    gradeLevelId: 'level',
    name: 'Grade 6 A',
  })
  await app.scheduling.createCalendarEvent({
    id: 'calendar-event',
    schoolId: 'school',
    academicYearId: 'year',
    title: 'Staff planning day',
    startDate: new Date('2026-09-04T00:00:00Z'),
    endDate: new Date('2026-09-04T23:59:59Z'),
    kind: CalendarEventKind.Event,
  })
  await app.assessments.createReportCardDefinition({
    id: 'definition',
    schoolId: 'school',
    academicYearId: 'year',
    gradeLevelId: 'level',
    name: 'Grade 6 Standard',
    isDefault: true,
  })
  await app.setup.registerStaffMember({
    id: 'teacher',
    schoolId: 'school',
    firstName: 'Binta',
    lastName: 'Sow',
    roles: [StaffRole.Teacher],
  })
  await app.setup.registerStaffMember({
    id: 'accountant',
    schoolId: 'school',
    firstName: 'Mariama',
    lastName: 'Ba',
    roles: [StaffRole.Accountant],
  })
  await app.setup.registerStaffMember({
    id: 'coordinator',
    schoolId: 'school',
    firstName: 'Aminata',
    lastName: 'Sy',
    roles: [StaffRole.Coordinator],
  })
  await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
  await app.students.registerStudent({ id: 'other-student', schoolId: 'school', firstName: 'Moussa', lastName: 'Diallo' })
  await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
  await app.students.enrollStudent({ id: 'other-enrollment', studentId: 'other-student', classGroupId: 'class' })
  await app.students.registerGuardian({ id: 'guardian', schoolId: 'school', firstName: 'Nadia', lastName: 'Diallo' })
  await app.students.registerGuardian({ id: 'other-guardian', schoolId: 'school', firstName: 'Fatou', lastName: 'Ba' })
  await app.students.linkGuardianToStudent({ id: 'guardian-link', guardianId: 'guardian', studentId: 'student' })
  await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
  const classSubject = await app.academics.offerSubjectToClass({
    id: 'class-math',
    classGroupId: 'class',
    subjectId: 'math',
  })
  await app.academics.createSubjectMatter({ id: 'fractions', subjectId: 'math', name: 'Fractions', sequenceOrder: 1 })
  const classMatter = await app.academics.assignMatterToClassSubject({
    id: 'class-fractions',
    classSubjectId: classSubject.id,
    subjectMatterId: 'fractions',
  })
  const session = await app.scheduling.createSession({
    id: 'lesson',
    schoolId: 'school',
    classGroupId: 'class',
    classSubjectId: classSubject.id,
    title: 'Fractions',
    kind: SessionKind.Course,
    startsAt: new Date('2026-09-01T08:00:00Z'),
    endsAt: new Date('2026-09-01T09:00:00Z'),
  })
  await app.assessments.createAssessment({
    id: 'quiz',
    classGroupId: 'class',
    classSubjectId: classSubject.id,
    periodId: 'term',
    title: 'Fractions quiz',
    kind: AssessmentKind.Quiz,
    maxScore: 20,
    sessionId: session.id,
  })
  await app.finance.createFee({
    id: 'tuition',
    schoolId: 'school',
    academicYearId: 'year',
    name: 'Tuition',
    defaultAmount: 90000,
    currency: 'XAF',
  })
  const studentFee = await app.finance.assignFeeToStudent({
    id: 'student-fee',
    studentId: 'student',
    feeId: 'tuition',
  })
  await app.communications.createAnnouncement({
    id: 'announcement',
    schoolId: 'school',
    title: 'General notice',
    content: 'Administrative communications.',
  })
  await app.communications.addTarget({
    id: 'school-target',
    announcementId: 'announcement',
    targetKind: AnnouncementTargetKind.School,
  })
  await app.communications.publishAnnouncement({ announcementId: 'announcement' })
  return { app, repositories, forActor, classSubject, classMatter, session, studentFee }
}

describe('actor-bound service authorization', () => {
  it('allows an assigned teacher to record instructional state and derives attribution', async () => {
    const { app, repositories, forActor, classSubject, classMatter, session } = await createAuthorizedFixture()
    const teacher = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'teacher-request',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))

    await expect(teacher.scheduling.recordAttendance({
      id: 'blocked',
      studentId: 'student',
      sessionId: session.id,
      status: AttendanceStatus.Present,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    await app.setup.assignStaffToClassSubject({
      id: 'teacher-subject',
      staffId: 'teacher',
      classSubjectId: classSubject.id,
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToClass({
      id: 'teacher-class',
      staffId: 'teacher',
      classGroupId: 'class',
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToSession({
      id: 'teacher-session',
      staffId: 'teacher',
      sessionId: session.id,
      role: StaffRole.Teacher,
    })
    await app.setup.registerAttachment({
      id: 'student-attachment',
      schoolId: 'school',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student',
      fileName: 'profile.pdf',
      fileUrl: 'https://files.example.test/profile.pdf',
    })
    await expect(teacher.setup.registerAttachment({
      id: 'teacher-attachment',
      schoolId: 'school',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student',
      fileName: 'teacher.pdf',
      fileUrl: 'https://files.example.test/teacher.pdf',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    expect((await teacher.queries.listAttachments({
      schoolId: 'school',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student',
    })).attachments.map(attachment => attachment.id)).toEqual(['student-attachment'])
    await expect(teacher.setup.createResource({
      id: 'teacher-room',
      schoolId: 'school',
      name: 'Teacher Room',
      kind: ResourceKind.Location,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    const attendance = await teacher.scheduling.recordAttendance({
      id: 'attendance',
      studentId: 'student',
      sessionId: session.id,
      status: AttendanceStatus.Present,
    })
    const progress = await teacher.academics.recordSessionProgress({
      id: 'progress',
      classSubjectMatterId: classMatter.id,
      sessionId: session.id,
      completedPercentage: 25,
    })
    const assessmentResult = await teacher.assessments.recordAssessmentResult({
      id: 'grade',
      studentId: 'student',
      assessmentId: 'quiz',
      score: 17,
    })

    expect(attendance.createdBy).toBe('teacher')
    expect(progress.recordedByStaffId).toBe('teacher')
    expect(assessmentResult.createdBy).toBe('teacher')
    expect(await repositories.attendanceRepository.list({ sessionId: session.id })).toHaveLength(1)
  })

  it('restricts financial mutations to permitted staff and derives payment attribution', async () => {
    const { forActor, studentFee } = await createAuthorizedFixture()
    const teacher = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'teacher-payment',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const accountant = forActor(createStaffActorMetadata({
      subjectId: 'accountant-user',
      staffMemberId: 'accountant',
      schoolId: 'school',
      roles: [StaffRole.Accountant],
      requestId: 'accountant-payment',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))

    await expect(teacher.finance.recordPayment({
      id: 'forbidden-payment',
      studentFeeId: studentFee.id,
      amount: 1000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.finance.adjustStudentFee({
      studentFeeId: studentFee.id,
      adjustmentAmount: 1000,
      reason: 'Unauthorized adjustment',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    const adjustedFee = await accountant.finance.adjustStudentFee({
      studentFeeId: studentFee.id,
      adjustmentAmount: 1000,
      reason: 'Approved adjustment',
      adjustedAt: new Date('2026-09-01T09:00:00Z'),
    })
    expect(adjustedFee.adjustedById).toBe('accountant')
    const payment = await accountant.finance.recordPayment({
      id: 'payment',
      studentFeeId: studentFee.id,
      amount: 1000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    expect(payment.recordedById).toBe('accountant')
    await expect(teacher.finance.cancelPayment({ paymentId: payment.id }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    const cancelledPayment = await accountant.finance.cancelPayment({
      paymentId: payment.id,
      cancelledAt: new Date('2026-09-01T10:00:00Z'),
    })
    expect(cancelledPayment.cancelledById).toBe('accountant')
    const cancelledFee = await accountant.finance.cancelStudentFee({
      studentFeeId: studentFee.id,
      reason: 'Fee assigned in error',
      cancelledAt: new Date('2026-09-01T11:00:00Z'),
    })
    expect(cancelledFee.cancelledById).toBe('accountant')
  })

  it('limits guardian and student reads to their own linked records', async () => {
    const { app, repositories, forActor, classSubject } = await createAuthorizedFixture()
    await app.assessments.publishReportCardResult({ id: 'report-card', studentId: 'student', periodId: 'term' })
    await repositories.studentHealthProfileRepository.save(new StudentHealthProfile({
      id: 'health',
      schoolId: 'school',
      studentId: 'student',
      allergies: 'Peanuts',
    }))
    await repositories.studentNoteRepository.save(new StudentNote({
      id: 'admin-note',
      schoolId: 'school',
      studentId: 'student',
      authorStaffId: 'admin',
      body: 'Internal context.',
      visibility: StudentNoteVisibility.AdminOnly,
    }))
    await repositories.studentNoteRepository.save(new StudentNote({
      id: 'guardian-note',
      schoolId: 'school',
      studentId: 'student',
      authorStaffId: 'admin',
      body: 'Family-visible context.',
      visibility: StudentNoteVisibility.GuardianVisible,
    }))
    const guardian = forActor(createGuardianActorMetadata({
      subjectId: 'guardian-user',
      guardianId: 'guardian',
      schoolId: 'school',
      requestId: 'guardian-read',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const otherGuardian = forActor(createGuardianActorMetadata({
      subjectId: 'other-guardian-user',
      guardianId: 'other-guardian',
      schoolId: 'school',
      requestId: 'other-guardian-read',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const student = forActor(createStudentActorMetadata({
      subjectId: 'student-user',
      studentId: 'student',
      schoolId: 'school',
      requestId: 'student-read',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))

    expect((await guardian.queries.listMyStudents())[0]?.id).toBe('student')
    const guardianDetail = await guardian.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' })
    expect(guardianDetail.healthProfile).toBeUndefined()
    expect(guardianDetail.notes.map(note => note.id)).toEqual(['guardian-note'])
    expect(guardianDetail.financeSummary?.itemCount).toBe(1)
    expect(guardianDetail.publishedReportCards.map(reportCard => reportCard.id)).toEqual(['report-card'])
    expect(guardianDetail.guardians.map(row => row.guardian.id)).toEqual(['guardian'])
    expect((await guardian.finance.buildFeeSummary('student')).itemCount).toBe(1)
    expect((await guardian.queries.getFinanceLedger({ schoolId: 'school', studentId: 'student' })).items).toHaveLength(1)
    await expect(guardian.queries.getStudentEnrollmentHistory({ schoolId: 'school', studentId: 'student' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(guardian.queries.getReportCardDetail({ schoolId: 'school', reportCardResultId: 'report-card' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(guardian.queries.getAssessmentEntryReview({ schoolId: 'school', assessmentId: 'quiz' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(guardian.queries.getAnnouncementDetail({ schoolId: 'school', announcementId: 'announcement' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(guardian.queries.getCalendarEvents({ schoolId: 'school', academicYearId: 'year' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(guardian.queries.getClassSubjectProgressDetail({ schoolId: 'school', classSubjectId: classSubject.id }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      otherGuardian.finance.buildFeeSummary('student'),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      otherGuardian.queries.getFinanceLedger({ schoolId: 'school', studentId: 'student' }),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      otherGuardian.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' }),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      otherGuardian.queries.getFinanceLedger({ schoolId: 'school', studentId: 'missing-student' }),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      otherGuardian.finance.buildFeeSummary('missing-student'),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    expect((await student.finance.buildFeeSummary('student')).itemCount).toBe(1)
    const studentDetail = await student.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' })
    expect(studentDetail.healthProfile).toBeUndefined()
    expect(studentDetail.notes.map(note => note.id)).toEqual([])
    expect(studentDetail.financeSummary).toBeUndefined()
    expect((await student.queries.getFinanceLedger({ schoolId: 'school', studentId: 'student' })).items).toHaveLength(1)
    await expect(student.queries.getStudentEnrollmentHistory({ schoolId: 'school', studentId: 'student' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(student.queries.getReportCardDetail({ schoolId: 'school', reportCardResultId: 'report-card' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(student.queries.getAssessmentEntryReview({ schoolId: 'school', assessmentId: 'quiz' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(student.queries.listAnnouncements({ schoolId: 'school' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(student.queries.getCalendarEvents({ schoolId: 'school', academicYearId: 'year' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(student.queries.getClassSubjectProgressDetail({ schoolId: 'school', classSubjectId: classSubject.id }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      student.finance.buildFeeSummary('other-student'),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      student.queries.getFinanceLedger({ schoolId: 'school', studentId: 'other-student' }),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      student.queries.getStudentDetail({ schoolId: 'school', studentId: 'other-student' }),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      student.queries.getFinanceLedger({ schoolId: 'school', studentId: 'missing-student' }),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(
      student.finance.buildFeeSummary('missing-student'),
    ).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
  })

  it('separates sensitive school projections from assignment-scoped reads', async () => {
    const { app, repositories, forActor, classSubject, session } = await createAuthorizedFixture()
    await app.assessments.publishReportCardResult({ id: 'report-card', studentId: 'student', periodId: 'term' })
    await repositories.studentHealthProfileRepository.save(new StudentHealthProfile({
      id: 'health',
      schoolId: 'school',
      studentId: 'student',
      allergies: 'Peanuts',
    }))
    await repositories.studentNoteRepository.save(new StudentNote({
      id: 'staff-note',
      schoolId: 'school',
      studentId: 'student',
      authorStaffId: 'admin',
      body: 'Staff-visible context.',
      visibility: StudentNoteVisibility.Staff,
      createdAt: new Date('2026-09-03T00:00:00Z'),
      updatedAt: new Date('2026-09-03T00:00:00Z'),
    }))
    await repositories.studentNoteRepository.save(new StudentNote({
      id: 'admin-note',
      schoolId: 'school',
      studentId: 'student',
      authorStaffId: 'admin',
      body: 'Admin-only context.',
      visibility: StudentNoteVisibility.AdminOnly,
      createdAt: new Date('2026-09-02T00:00:00Z'),
      updatedAt: new Date('2026-09-02T00:00:00Z'),
    }))
    const teacher = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'teacher-queries',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const accountant = forActor(createStaffActorMetadata({
      subjectId: 'accountant-user',
      staffMemberId: 'accountant',
      schoolId: 'school',
      roles: [StaffRole.Accountant],
      requestId: 'accountant-queries',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const coordinator = forActor(createStaffActorMetadata({
      subjectId: 'coordinator-user',
      staffMemberId: 'coordinator',
      schoolId: 'school',
      roles: [StaffRole.Coordinator],
      requestId: 'coordinator-queries',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    await app.setup.assignStaffToClass({
      id: 'teacher-class',
      staffId: 'teacher',
      classGroupId: 'class',
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToClassSubject({
      id: 'teacher-subject',
      staffId: 'teacher',
      classSubjectId: classSubject.id,
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToSession({
      id: 'teacher-session',
      staffId: 'teacher',
      sessionId: session.id,
      role: StaffRole.Teacher,
    })
    const behaviorAction = await app.behavior.createDisciplinaryAction({
      id: 'warning',
      schoolId: 'school',
      name: 'Warning',
      kind: DisciplinaryActionKind.Sanction,
    })
    const teacherIncident = await teacher.behavior.recordIncident({
      id: 'teacher-incident',
      schoolId: 'school',
      classGroupId: 'class',
      sessionId: session.id,
      title: 'Class disruption',
      description: 'Reported by assigned teacher.',
      date: new Date('2026-09-01T08:30:00Z'),
      kind: IncidentKind.MinorInfraction,
    })
    await teacher.behavior.addStudentInvolvement({
      id: 'teacher-incident-student',
      incidentId: teacherIncident.id,
      studentId: 'student',
      role: IncidentInvolvementRole.Subject,
    })
    await expect(teacher.behavior.applyDisciplinaryAction({
      id: 'teacher-applied-action',
      incidentId: teacherIncident.id,
      studentId: 'student',
      disciplinaryActionId: behaviorAction.id,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.behavior.resolveIncident({ incidentId: teacherIncident.id }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    expect((await teacher.queries.getIncidentDetail({
      schoolId: 'school',
      incidentId: teacherIncident.id,
    })).incident.reporterId).toBe('teacher')
    expect((await teacher.queries.listStudentIncidents({ schoolId: 'school', studentId: 'student' })).rows)
      .toHaveLength(1)
    const coordinatorAppliedAction = await coordinator.behavior.applyDisciplinaryAction({
      id: 'coordinator-applied-action',
      incidentId: teacherIncident.id,
      studentId: 'student',
      disciplinaryActionId: behaviorAction.id,
    })
    expect(coordinatorAppliedAction.assignedByStaffId).toBe('coordinator')

    await app.scheduling.recordAttendance({
      id: 'absence-to-review',
      studentId: 'student',
      sessionId: session.id,
      status: AttendanceStatus.Absent,
    })
    await expect(teacher.scheduling.reviewAttendanceJustification({
      studentId: 'student',
      sessionId: session.id,
      decision: AttendanceJustificationStatus.Excused,
      reason: 'Teacher cannot approve this decision',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    const reviewedAbsence = await coordinator.scheduling.reviewAttendanceJustification({
      studentId: 'student',
      sessionId: session.id,
      decision: AttendanceJustificationStatus.Excused,
      reason: 'Approved medical absence',
      notes: 'Verified by school office',
      reviewedAt: new Date('2026-09-02T08:00:00Z'),
    })
    expect(reviewedAbsence.justifiedByStaffId).toBe('coordinator')
    expect(await teacher.queries.listClassGroupTimetable('class')).toHaveLength(1)
    expect((await teacher.queries.getAttendanceSessionReview({
      schoolId: 'school',
      classGroupId: 'class',
      date: session.startsAt,
      sessionId: session.id,
    })).rows[0]?.record?.reason).toBe('Approved medical absence')
    const teacherDetail = await teacher.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' })
    expect(teacherDetail.healthProfile).toBeUndefined()
    expect(teacherDetail.financeSummary).toBeUndefined()
    expect(teacherDetail.notes.map(note => note.id)).toEqual(['staff-note'])
    expect(teacherDetail.publishedReportCards.map(reportCard => reportCard.id)).toEqual(['report-card'])
    expect(await teacher.assessments.listClassSubjectAssessmentResultsForPeriod({
      classSubjectId: classSubject.id,
      periodId: 'term',
    })).toEqual([])
    expect((await teacher.queries.getAssessmentEntryReview({ schoolId: 'school', assessmentId: 'quiz' })).rows)
      .toHaveLength(2)
    expect((await teacher.queries.getClassSubjectProgressDetail({
      schoolId: 'school',
      classSubjectId: classSubject.id,
    })).matters).toHaveLength(1)
    await expect(teacher.queries.getAnnouncementDetail({ schoolId: 'school', announcementId: 'announcement' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.communications.materializeDeliveries({
      announcementId: 'announcement',
      channel: MessageDeliveryChannel.App,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.queries.getCalendarEvents({ schoolId: 'school', academicYearId: 'year', classGroupId: 'class' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.scheduling.createCalendarEvent({
      id: 'teacher-event',
      schoolId: 'school',
      academicYearId: 'year',
      title: 'Teacher event',
      startDate: new Date('2026-09-05T00:00:00Z'),
      endDate: new Date('2026-09-05T23:59:59Z'),
      kind: CalendarEventKind.Event,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.setup.updateClassGroupConfiguration({
      classGroupId: 'class',
      capacity: 30,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.setup.publishAcademicPeriod({ academicPeriodId: 'term' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.queries.getSchoolOverview({ schoolId: 'school' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(accountant.queries.listStudents({ schoolId: 'school' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(teacher.queries.getStudentEnrollmentHistory({ schoolId: 'school', studentId: 'student' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(accountant.queries.getStudentEnrollmentHistory({ schoolId: 'school', studentId: 'student' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    expect((await coordinator.queries.getStudentEnrollmentHistory({ schoolId: 'school', studentId: 'student' })).history)
      .toHaveLength(1)
    await expect(teacher.queries.getReportCardDetail({ schoolId: 'school', reportCardResultId: 'report-card' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(accountant.queries.getReportCardDetail({ schoolId: 'school', reportCardResultId: 'report-card' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(accountant.queries.getAssessmentEntryReview({ schoolId: 'school', assessmentId: 'quiz' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(accountant.queries.listAnnouncements({ schoolId: 'school' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(accountant.queries.getCalendarEvents({ schoolId: 'school', academicYearId: 'year' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(accountant.queries.getClassSubjectProgressDetail({ schoolId: 'school', classSubjectId: classSubject.id }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    const accountantDetail = await accountant.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' })
    expect(accountantDetail.financeSummary?.itemCount).toBe(1)
    expect(accountantDetail.healthProfile).toBeUndefined()
    expect(accountantDetail.notes).toEqual([])
    expect(accountantDetail.publishedReportCards).toEqual([])
    expect((await coordinator.queries.getReportCardDetail({ schoolId: 'school', reportCardResultId: 'report-card' })).reportCard.id)
      .toBe('report-card')
    const coordinatorDetail = await coordinator.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' })
    expect(coordinatorDetail.healthProfile?.id).toBe('health')
    expect(coordinatorDetail.notes.map(note => note.id)).toEqual(['staff-note', 'admin-note'])
    expect(coordinatorDetail.enrollmentHistory).toHaveLength(1)
    expect((await coordinator.queries.getAssessmentEntryReview({ schoolId: 'school', assessmentId: 'quiz' })).assessment.id)
      .toBe('quiz')
    expect((await coordinator.queries.getAnnouncementDetail({ schoolId: 'school', announcementId: 'announcement' })).announcement.id)
      .toBe('announcement')
    expect((await coordinator.queries.listAnnouncements({ schoolId: 'school' })).rows).toHaveLength(1)
    expect((await coordinator.queries.getClassSubjectProgressDetail({
      schoolId: 'school',
      classSubjectId: classSubject.id,
    })).matters).toHaveLength(1)
    await coordinator.scheduling.createCalendarEvent({
      id: 'class-calendar-event',
      schoolId: 'school',
      academicYearId: 'year',
      title: 'Class closure',
      startDate: new Date('2026-09-06T00:00:00Z'),
      endDate: new Date('2026-09-06T23:59:59Z'),
      kind: CalendarEventKind.Event,
      scopeKind: CalendarEventScopeKind.ClassGroup,
      scopeId: 'class',
    })
    expect((await coordinator.queries.getCalendarEvents({
      schoolId: 'school',
      academicYearId: 'year',
      classGroupId: 'class',
    })).events.map(event => event.id)).toEqual(['calendar-event', 'class-calendar-event'])
    expect((await coordinator.setup.updateClassGroupConfiguration({
      classGroupId: 'class',
      capacity: 30,
    })).capacity).toBe(30)
    expect((await coordinator.setup.publishAcademicPeriod({ academicPeriodId: 'term' })).isPublished).toBe(true)
    expect((await coordinator.communications.materializeDeliveries({
      announcementId: 'announcement',
      channel: MessageDeliveryChannel.App,
    })).length).toBeGreaterThan(0)
    await expect(teacher.queries.getFinanceLedger({ schoolId: 'school', studentId: 'student' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    expect((await accountant.finance.buildFeeSummary('student')).itemCount).toBe(1)
    expect((await accountant.queries.getFinanceLedger({ schoolId: 'school', studentId: 'student' })).items).toHaveLength(1)
  })

  it('evaluates current staff, guardian, and student access state on each call', async () => {
    const { app, repositories, forActor, session } = await createAuthorizedFixture()
    const teacher = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'revoked-teacher',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const guardian = forActor(createGuardianActorMetadata({
      subjectId: 'guardian-user',
      guardianId: 'guardian',
      schoolId: 'school',
      requestId: 'revoked-guardian',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const student = forActor(createStudentActorMetadata({
      subjectId: 'student-user',
      studentId: 'student',
      schoolId: 'school',
      requestId: 'inactive-student',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    await app.setup.assignStaffToSession({
      id: 'teacher-session',
      staffId: 'teacher',
      role: StaffRole.Teacher,
      sessionId: session.id,
    })
    await repositories.staffMemberRepository.save(new StaffMember({
      id: 'teacher',
      schoolId: 'school',
      firstName: 'Binta',
      lastName: 'Sow',
      roles: [StaffRole.Teacher],
      isActive: false,
    }))
    await repositories.guardianRepository.save(new Guardian({
      id: 'guardian',
      schoolId: 'school',
      firstName: 'Nadia',
      lastName: 'Diallo',
      hasAccess: false,
    }))
    await repositories.studentRepository.save(new Student({
      id: 'student',
      schoolId: 'school',
      firstName: 'Amira',
      lastName: 'Diallo',
      status: StudentStatus.Inactive,
    }))

    await expect(teacher.scheduling.recordAttendance({
      id: 'inactive-staff-write',
      studentId: 'student',
      sessionId: session.id,
      status: AttendanceStatus.Present,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(guardian.queries.listMyStudents())
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(student.finance.buildFeeSummary('student'))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
  })
})
