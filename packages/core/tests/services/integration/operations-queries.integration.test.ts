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
    const guardianStudents = await app.queries.listStudentsForGuardian('guardian')
    expect(studentDirectory.rows[0]?.balanceDue).toBe(60000)
    expect(studentDirectory.rows[0]?.guardianCount).toBe(1)
    expect(schoolOverview.overdueFeeCount).toBe(1)
    expect(schoolOverview.recentAnnouncements[0]?.id).toBe('fee-reminder')
    expect(classGroups.rows[0]?.studentCount).toBe(1)
    expect(guardianStudents[0]?.id).toBe('student')
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
      date: new Date('2026-09-01T00:00:00Z'),
      sessionId: session.id,
    })
    expect(workspace.teacherCourseLoads[0]?.assignedCourseCount).toBe(1)
    expect(classGroups.rows[0]?.teacherNames).toEqual(['Binta Sow'])
    expect(timetable[0]?.courseName).toBe('Mathematics')
    expect(timetable[0]?.teacherName).toBe('Binta Sow')
    expect(attendanceReview.summary).toEqual({ present: 0, absent: 0, late: 1, total: 1 })
    expect(await repositories.staffAssignmentRepository.list({ classGroupId: 'class' })).toHaveLength(1)
    expect(await repositories.staffAssignmentRepository.list({ sessionId: session.id })).toHaveLength(1)
    expect(await repositories.staffAssignmentRepository.list({ groupedSessionId: groupedSession.id })).toHaveLength(1)
  })
})
