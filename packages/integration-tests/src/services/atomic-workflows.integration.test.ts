import {
  AcademicPeriodType,
  AnnouncementTargetKind,
  AttendanceStatus,
  AuthorizationErrorCode,
  FeeStatus,
  GradeLevel,
  MessageDeliveryChannel,
  PaymentMethod,
  PaymentStatus,
  SessionKind,
  Subject,
  SubjectMatter,
} from '@edaya/core'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import {
  adjustStudentFee,
  cancelStudentFee,
  createAcademicPeriod,
  createClassGroup,
  listMatterProgress,
  saveAnnouncement,
  saveAnnouncementTarget,
  saveClassSubject,
  saveClassSubjectMatter,
  saveFee,
  saveGuardian,
  saveReportCardDefinition,
  saveSchedule,
  saveSchool,
  saveSession,
  saveStudent,
} from '../utils/core-service-helpers'
import { createTestApp } from '../utils/test-adapter'

describeIntegration('atomic workflow safeguards', () => {
  it('rolls back curriculum progress when a later aggregate write fails', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await saveSchool(app, { id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.base.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 }),
    )
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.base.subjects.save(
      new Subject({ id: 'math', schoolId: 'school', name: 'Mathematics' }),
    )
    const classSubject = await saveClassSubject(app, {
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
    })
    await app.base.subjectMatters.save(
      new SubjectMatter({ id: 'fractions', subjectId: 'math', name: 'Fractions', sequenceOrder: 1 }),
    )
    const classMatter = await saveClassSubjectMatter(app, {
      id: 'class-fractions',
      classSubjectId: classSubject.id,
      subjectMatterId: 'fractions',
    })
    await saveSession(app, {
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    failSaveOnAttempt('classSubjectMatterRepository')
    await expect(app.recordSessionProgress({
      id: 'progress',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson',
      completedPercentage: 50,
    })).rejects.toThrow('Simulated classSubjectMatterRepository save failure')
    expect(await listMatterProgress(app, classMatter.id)).toHaveLength(0)
    expect((await repositories.classSubjectMatterRepository.findById(classMatter.id))?.completedPercentage).toBe(0)
    expect((await repositories.classSubjectRepository.findById(classSubject.id))?.completedPercentage).toBe(0)
  })

  it('rolls back payment and fee lifecycle changes when balance writes fail', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await saveSchool(app, { id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await saveStudent(app, { id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await saveFee(app, {
      id: 'tuition',
      schoolId: 'school',
      academicYearId: 'year',
      name: 'Tuition',
      defaultAmount: 90000,
      currency: 'XAF',
    })
    const studentFee = await app.assignFeeToStudent({
      id: 'student-tuition',
      studentId: 'student',
      feeId: 'tuition',
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })
    failSaveOnAttempt('studentFeeRepository')
    await expect(app.recordPayment({
      id: 'payment',
      studentFeeId: studentFee.id,
      amount: 30000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect(await repositories.paymentRepository.findById('payment')).toBeUndefined()
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.paidAmount.amount).toBe(0)
    await app.recordPayment({
      id: 'payment',
      studentFeeId: studentFee.id,
      amount: 30000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    failSaveOnAttempt('studentFeeRepository')
    await expect(
      app.reversePayment({ paymentId: 'payment' }),
    ).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.paymentRepository.findById('payment'))?.status).toBe(PaymentStatus.Recorded)
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.paidAmount.amount).toBe(30000)
    failSaveOnAttempt('studentFeeRepository')
    await expect(app.cancelPayment({ paymentId: 'payment' }))
      .rejects
      .toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.paymentRepository.findById('payment'))?.status).toBe(PaymentStatus.Recorded)
    failSaveOnAttempt('studentFeeRepository')
    await expect(adjustStudentFee(app, {
      studentFeeId: studentFee.id,
      adjustmentAmount: 10000,
      reason: 'Adjustment',
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.adjustmentAmount.amount).toBe(0)
    await app.cancelPayment({ paymentId: 'payment' })
    failSaveOnAttempt('studentFeeRepository')
    await expect(cancelStudentFee(app, {
      studentFeeId: studentFee.id,
      reason: 'Cancellation',
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.status).not.toBe(FeeStatus.Cancelled)
  })

  it('rolls back report-card publication when the published result cannot be saved', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await saveSchool(app, { id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await createAcademicPeriod(app, {
      id: 'term',
      schoolId: 'school',
      academicYearId: 'year',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await app.base.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 }),
    )
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await saveStudent(app, { id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await saveReportCardDefinition(app, {
      id: 'definition',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 Standard',
      isDefault: true,
    })
    failSaveOnAttempt('reportCardResultRepository')
    await expect(app.publishReportCardResult({
      id: 'report-card',
      studentId: 'student',
      periodId: 'term',
    })).rejects.toThrow('Simulated reportCardResultRepository save failure')
    expect(await repositories.reportCardResultRepository.findById('report-card')).toBeUndefined()
  })

  it('rolls back bulk attendance capture when a later roster entry is invalid', async () => {
    const { app, repositories } = createTestApp()
    await saveSchool(app, { id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.base.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 }),
    )
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await saveStudent(app, { id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await saveSession(app, {
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      title: 'Class attendance',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await expect(app.recordSessionAttendance({
      sessionId: 'lesson',
      attendanceByStudent: { student: AttendanceStatus.Present, missing: AttendanceStatus.Absent },
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    expect(await repositories.attendanceRepository.list({ sessionId: 'lesson' })).toHaveLength(0)
  })

  it('rolls back generated sessions when materializing a later schedule fails', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await saveSchool(app, { id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.base.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 }),
    )
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    const sessionDate = new Date('2026-09-01T00:00:00Z')
    for (const [id, title, startTime, endTime] of [
      ['morning', 'Morning', '08:00', '09:00'],
      ['afternoon', 'Afternoon', '13:00', '14:00'],
    ] as const) {
      await saveSchedule(app, {
        id,
        classGroupId: 'class',
        title,
        isRecurring: false,
        startTime,
        endTime,
        specificDate: sessionDate,
      })
    }
    failSaveOnAttempt('sessionRepository', 2)
    await expect(app.generateSessions({
      classGroupId: 'class',
      startDate: sessionDate,
      endDate: sessionDate,
    })).rejects.toThrow('Simulated sessionRepository save failure')
    expect(await repositories.sessionRepository.list({ classGroupId: 'class' })).toHaveLength(0)
  })

  it('rolls back generated communications deliveries when a later recipient save fails', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await saveSchool(app, { id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await saveGuardian(app, { id: 'guardian-a', schoolId: 'school', firstName: 'Awa', lastName: 'Ba' })
    await saveGuardian(app, { id: 'guardian-b', schoolId: 'school', firstName: 'Mariama', lastName: 'Ba' })
    await saveAnnouncement(app, {
      id: 'announcement',
      schoolId: 'school',
      title: 'Reminder',
      content: 'Administrative reminder.',
    })
    await saveAnnouncementTarget(app, {
      id: 'all-guardians',
      announcementId: 'announcement',
      targetKind: AnnouncementTargetKind.AllGuardians,
    })
    await app.publishAnnouncement({ announcementId: 'announcement' })
    failSaveOnAttempt('messageDeliveryRepository', 2)
    await expect(app.materializeDeliveries({
      announcementId: 'announcement',
      channel: MessageDeliveryChannel.App,
    })).rejects.toThrow('Simulated messageDeliveryRepository save failure')
    expect(await repositories.messageDeliveryRepository.list({ announcementId: 'announcement' })).toHaveLength(0)
  })
})
