import { describe, expect, it } from 'bun:test'
import {
  AcademicPeriodType,
  AnnouncementAudience,
  AnnouncementStatus,
  AnnouncementTargetKind,
  AttendanceStatus,
  FeeStatus,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
  PaymentMethod,
  PaymentStatus,
  SessionKind,
  StaffRole,
} from '../../../src/entities'
import { AuthorizationErrorCode } from '../../../src/services/authorization'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('operations query journey', () => {
  it('projects finance and communications state through the screen query facade', async () => {
    const { app, repositories } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
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
    await app.students.registerGuardian({
      id: 'guardian',
      schoolId: 'school',
      firstName: 'Nadia',
      lastName: 'Diallo',
      email: 'nadia@example.test',
    })
    await app.students.linkGuardianToStudent({
      id: 'guardian-link',
      guardianId: 'guardian',
      studentId: 'student',
      isPrimary: true,
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
      id: 'student-tuition',
      studentId: 'student',
      feeId: 'tuition',
      dueDate: new Date('2026-09-15T00:00:00Z'),
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })
    await app.finance.recordPayment({
      id: 'tuition-payment',
      studentFeeId: studentFee.id,
      amount: 30000,
      paymentDate: new Date('2026-09-20T00:00:00Z'),
      method: PaymentMethod.MobileMoney,
      referenceDate: new Date('2026-09-20T00:00:00Z'),
    })
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.status).toBe(FeeStatus.Overdue)
    await app.finance.recordPayment({
      id: 'tuition-final-payment',
      studentFeeId: studentFee.id,
      amount: 60000,
      paymentDate: new Date('2026-09-21T00:00:00Z'),
      method: PaymentMethod.Cash,
      referenceDate: new Date('2026-09-21T00:00:00Z'),
    })
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.status).toBe(FeeStatus.Paid)
    expect((await app.finance.buildFeeSummary('student')).balanceDue.amount).toBe(0)
    const reversed = await app.finance.reversePayment({
      paymentId: 'tuition-final-payment',
      reversedAt: new Date('2026-09-22T00:00:00Z'),
      referenceDate: new Date('2026-09-22T00:00:00Z'),
    })
    expect(reversed.status).toBe(PaymentStatus.Reversed)
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.status).toBe(FeeStatus.Overdue)
    const feeSummary = await app.finance.buildFeeSummary('student')
    expect(feeSummary.totalPaid.amount).toBe(30000)
    expect(feeSummary.balanceDue.amount).toBe(60000)
    expect(feeSummary.totalOverdue.amount).toBe(60000)

    await app.communications.createAnnouncement({
      id: 'fee-reminder',
      schoolId: 'school',
      title: 'Fee reminder',
      content: 'Please review the remaining tuition balance.',
      audience: AnnouncementAudience.ClassGroup,
      classGroupId: 'class',
      createdAt: new Date('2026-09-20T09:00:00Z'),
    })
    await expect(app.communications.recordDelivery({
      id: 'early-delivery',
      announcementId: 'fee-reminder',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'guardian',
      channel: MessageDeliveryChannel.Email,
      status: MessageDeliveryStatus.Sent,
    })).rejects.toThrow('must be published before recording delivery')
    await app.communications.addTarget({
      id: 'guardian-target',
      announcementId: 'fee-reminder',
      targetKind: AnnouncementTargetKind.Guardian,
      targetId: 'guardian',
    })
    const announcement = await app.communications.publishAnnouncement({
      announcementId: 'fee-reminder',
      publishedAt: new Date('2026-09-20T10:00:00Z'),
    })
    const delivery = await app.communications.recordDelivery({
      id: 'guardian-delivery',
      announcementId: 'fee-reminder',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'guardian',
      channel: MessageDeliveryChannel.Email,
      status: MessageDeliveryStatus.Sent,
      sentAt: new Date('2026-09-20T10:01:00Z'),
    })
    const readDelivery = await app.communications.recordDelivery({
      id: 'guardian-read-delivery',
      announcementId: 'fee-reminder',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'guardian',
      channel: MessageDeliveryChannel.App,
      status: MessageDeliveryStatus.Read,
      sentAt: new Date('2026-09-20T10:02:00Z'),
      readAt: new Date('2026-09-20T10:03:00Z'),
    })
    const failedDelivery = await app.communications.recordDelivery({
      id: 'guardian-failed-delivery',
      announcementId: 'fee-reminder',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'guardian',
      channel: MessageDeliveryChannel.Sms,
      status: MessageDeliveryStatus.Failed,
      failureReason: 'provider rejected destination',
    })
    expect(announcement.status).toBe(AnnouncementStatus.Published)
    expect(delivery.status).toBe(MessageDeliveryStatus.Sent)
    expect(readDelivery.status).toBe(MessageDeliveryStatus.Read)
    expect(failedDelivery.status).toBe(MessageDeliveryStatus.Failed)
    const studentDirectory = await app.queries.listStudents({ schoolId: 'school' })
    const schoolOverview = await app.queries.getSchoolOverview({ schoolId: 'school' })
    const classGroups = await app.queries.listClassGroups({ schoolId: 'school' })
    const financeLedger = await app.queries.getFinanceLedger({
      schoolId: 'school',
      studentId: 'student',
      academicYearId: 'year',
    })
    const guardianStudents = await app.queries.listStudentsForGuardian('guardian')
    expect(studentDirectory.rows[0]?.balanceDue).toBe(60000)
    expect(studentDirectory.rows[0]?.guardianCount).toBe(1)
    expect(schoolOverview.overdueFeeCount).toBe(1)
    expect(schoolOverview.recentAnnouncements[0]?.id).toBe('fee-reminder')
    expect(classGroups.rows[0]?.studentCount).toBe(1)
    expect(financeLedger.student.id).toBe('student')
    expect(financeLedger.items[0]?.fee.id).toBe('tuition')
    expect(financeLedger.items[0]?.studentFee.status).toBe(FeeStatus.Overdue)
    expect(financeLedger.items[0]?.payments.map(payment => payment.status)).toEqual([
      PaymentStatus.Reversed,
      PaymentStatus.Recorded,
    ])
    expect(financeLedger.summary.balanceDue.amount).toBe(60000)
    expect(guardianStudents[0]?.id).toBe('student')
  })

  it('orders student and class directories independently of creation order', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class-b',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 B',
    })
    await app.setup.createClassGroup({
      id: 'class-a',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.students.registerStudent({
      id: 'student-z',
      schoolId: 'school',
      firstName: 'Zara',
      lastName: 'Barry',
    })
    await app.students.registerStudent({
      id: 'student-b',
      schoolId: 'school',
      firstName: 'Binta',
      lastName: 'Alpha',
    })
    await app.students.registerStudent({
      id: 'student-a',
      schoolId: 'school',
      firstName: 'Amira',
      lastName: 'Alpha',
    })

    const studentDirectory = await app.queries.listStudents({ schoolId: 'school' })
    const classDirectory = await app.queries.listClassGroups({ schoolId: 'school' })

    expect(studentDirectory.rows.map(row => row.student.id)).toEqual(['student-a', 'student-b', 'student-z'])
    expect(classDirectory.rows.map(row => row.classGroup.id)).toEqual(['class-a', 'class-b'])
  })
})

describe('assignment and query journey', () => {
  it('resolves staff assignments into timetable and attendance screen queries', async () => {
    const { app, repositories } = createTestApp()
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
    await app.setup.registerStaffMember({
      id: 'teacher',
      schoolId: 'school',
      firstName: 'Binta',
      lastName: 'Sow',
      roles: [StaffRole.Teacher],
    })
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
    await app.assessments.createGradeScale({
      id: 'percentage',
      schoolId: 'school',
      name: 'Percentage',
      minScore: 0,
      maxScore: 100,
      isDefault: true,
      ranges: [
        { letter: 'F', minScore: 0, maxScore: 49, isPassing: false },
        { letter: 'P', minScore: 50, maxScore: 100, isPassing: true },
      ],
    })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
    })
    const groupedSession = await app.scheduling.createGroupedSession({
      id: 'assembly',
      schoolId: 'school',
      academicYearId: 'year',
      academicPeriodId: 'term',
      title: 'Assembly',
      kind: SessionKind.Event,
      startsAt: new Date('2026-09-01T07:30:00Z'),
      endsAt: new Date('2026-09-01T08:00:00Z'),
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
    await app.setup.assignStaffToClass({
      id: 'class-teacher',
      staffId: 'teacher',
      classGroupId: 'class',
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToClassSubject({
      id: 'math-teacher',
      staffId: 'teacher',
      classSubjectId: classSubject.id,
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToSession({
      id: 'lesson-teacher',
      staffId: 'teacher',
      sessionId: session.id,
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToGroupedSession({
      id: 'assembly-teacher',
      staffId: 'teacher',
      groupedSessionId: groupedSession.id,
      role: StaffRole.Teacher,
    })
    await app.scheduling.recordAttendance({
      id: 'attendance',
      studentId: 'student',
      sessionId: session.id,
      status: AttendanceStatus.Late,
    })
    const workspace = await app.queries.getWorkspaceContext({ schoolId: 'school', classGroupId: 'class' })
    const classGroups = await app.queries.listClassGroups({ schoolId: 'school' })
    const timetable = await app.queries.listClassGroupTimetable('class')
    const attendanceReview = await app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      classGroupId: 'class',
      date: new Date('2026-09-01T00:00:00Z'),
      sessionId: session.id,
    })
    expect(workspace.activeAcademicYear?.id).toBe('year')
    expect(workspace.academicPeriods.map(period => period.id)).toEqual(['term'])
    expect(workspace.gradeLevels.map(gradeLevel => gradeLevel.id)).toEqual(['level'])
    expect(workspace.classGroups.map(classGroup => classGroup.id)).toEqual(['class'])
    expect(workspace.staffMembers.map(staffMember => staffMember.id)).toEqual(['teacher', 'admin'])
    expect(workspace.subjects.map(subject => subject.id)).toEqual(['math'])
    expect(workspace.gradeScales.map(gradeScale => gradeScale.id)).toEqual(['percentage'])
    expect(workspace.teacherCourseLoads[0]?.assignedCourseCount).toBe(1)
    expect(classGroups.rows[0]?.teacherNames).toEqual(['Binta Sow'])
    expect(timetable[0]?.courseName).toBe('Mathematics')
    expect(timetable[0]?.teacherName).toBe('Binta Sow')
    expect(attendanceReview.summary).toEqual({ present: 0, absent: 0, late: 1, total: 1 })
    expect(await repositories.staffAssignmentRepository.list({ classGroupId: 'class' })).toHaveLength(1)
    expect(await repositories.staffAssignmentRepository.list({ sessionId: session.id })).toHaveLength(1)
    expect(await repositories.staffAssignmentRepository.list({ groupedSessionId: groupedSession.id })).toHaveLength(1)
  })

  it('loads attendance for the selected class and rejects a session from another class', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createAcademicYear({
      id: 'other-year',
      schoolId: 'school',
      name: '2027-2028',
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2028-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'first-class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.setup.createClassGroup({
      id: 'selected-class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 B',
    })
    await app.students.registerStudent({
      id: 'selected-student',
      schoolId: 'school',
      firstName: 'Omar',
      lastName: 'Diallo',
    })
    await app.students.enrollStudent({
      id: 'selected-enrollment',
      studentId: 'selected-student',
      classGroupId: 'selected-class',
    })
    const selectedSession = await app.scheduling.createSession({
      id: 'selected-session',
      schoolId: 'school',
      classGroupId: 'selected-class',
      title: 'Selected class session',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await app.scheduling.recordAttendance({
      id: 'selected-attendance',
      studentId: 'selected-student',
      sessionId: selectedSession.id,
      status: AttendanceStatus.Absent,
    })

    const review = await app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      academicYearId: 'year',
      classGroupId: 'selected-class',
      date: new Date('2026-09-01T00:00:00Z'),
      sessionId: selectedSession.id,
    })
    expect(review.classGroup?.id).toBe('selected-class')
    expect(review.rows[0]?.student.id).toBe('selected-student')
    expect(review.summary).toEqual({ present: 0, absent: 1, late: 0, total: 1 })

    await expect(app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      classGroupId: 'first-class',
      date: new Date('2026-09-01T00:00:00Z'),
      sessionId: selectedSession.id,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await expect(app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      academicYearId: 'other-year',
      classGroupId: 'selected-class',
      date: new Date('2026-09-01T00:00:00Z'),
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
  })
})
