import { AuthorizationErrorCode } from '@edaya/authorization'
import { AcademicPeriodType, AnnouncementStatus, AnnouncementTargetKind, AttendanceStatus, ChargeStatus, DayOfWeek, GradeLevel, GradeScale, PaymentMethod, PaymentStatus, studentYearAccountId, Subject, SubjectMatter } from '@edaya/core'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import {
  adjustStudentFee,
  cancelStudentFee,
  createAcademicPeriod,
  createClassGroup,
  listMatterProgress,
  publishAcademicPeriod,
  saveAnnouncement,
  saveAnnouncementTarget,
  saveClassSubject,
  saveClassSubjectMatter,
  saveFee,
  saveGuardian,
  saveLessonSession,
  saveReportCardDefinition,
  saveSchedule,
  saveSchool,
  saveStudent,
} from '../utils/core-service-helpers'
import { createTestApp } from '../utils/test-adapter'

describeIntegration('atomic workflow safeguards', () => {
  it('rolls back curriculum progress when a later aggregate write fails', async () => {
    const { app, repositories, failSaveOnAttempt } = await createTestApp()
    await saveSchool(app, { id: 'school', name: 'Edaya', timeZone: 'UTC', financeCurrency: 'XAF' })
    await app.setupWorkflow.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.baseService.entities.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', label: 'G6', order: 6 }),
    )
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.baseService.entities.subjects.save(
      new Subject({ id: 'math', schoolId: 'school', name: 'Mathematics' }),
    )
    const classSubject = await saveClassSubject(app, {
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
      gradeLevelSubjectId: 'gls-math',
    })
    await app.baseService.entities.subjectMatters.save(
      new SubjectMatter({ id: 'fractions', subjectId: 'math', name: 'Fractions', sequenceOrder: 1 }),
    )
    const classMatter = await saveClassSubjectMatter(app, {
      id: 'class-fractions',
      classSubjectId: classSubject.id,
      subjectMatterId: 'fractions',
    })
    await saveLessonSession(app, {
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      displayLabel: 'Fractions',
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    failSaveOnAttempt('classSubjectMatterRepository')
    await expect(app.academicsWorkflow.recordLessonSessionProgress({
      id: 'progress',
      classSubjectMatterId: classMatter.id,
      lessonSessionId: 'lesson',
      completedPercentage: 50,
    })).rejects.toThrow('Simulated classSubjectMatterRepository save failure')
    expect(await listMatterProgress(app, classMatter.id)).toHaveLength(0)
    expect((await repositories.classSubjectMatterRepository.findById(classMatter.id))?.completedPercentage).toBe(0)
    expect((await repositories.classSubjectRepository.findById(classSubject.id))?.completedPercentage).toBe(0)
  })

  it('rolls back payment and fee lifecycle changes when balance writes fail', async () => {
    const { app, repositories, failSaveOnAttempt } = await createTestApp()
    await saveSchool(app, { id: 'school', name: 'Edaya', timeZone: 'UTC', financeCurrency: 'XAF' })
    await app.setupWorkflow.createAcademicYear({
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
    const enrollment = await app.financeWorkflow.enrollStudentInService({
      id: 'student-tuition',
      studentId: 'student',
      catalogServiceId: 'tuition',
    })
    failSaveOnAttempt('studentFeeRepository')
    await expect(app.financeWorkflow.recordPayment({
      id: 'payment',
      studentId: 'student',
      academicYearId: 'year',
      amount: 30000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      allocation: { mode: 'fifo' },
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect(await repositories.paymentRepository.findById('payment')).toBeUndefined()
    expect((await repositories.studentFeeRepository.findById(enrollment.id))?.allocatedAmount.amount).toBe(0)
    await app.financeWorkflow.recordPayment({
      id: 'payment',
      studentId: 'student',
      academicYearId: 'year',
      amount: 30000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      allocation: { mode: 'fifo' },
    })
    const accountId = studentYearAccountId('school', 'student', 'year', 'XAF')
    const history = await app.financeWorkflow.getPaymentSettlementHistory({ accountId })
    const allocationIds = history.allocations
      .filter(allocation => allocation.causedByPaymentId === 'payment' && allocation.kind === 'settle')
      .map(allocation => allocation.id)
    failSaveOnAttempt('studentFeeRepository')
    await expect(
      app.financeWorkflow.reversePayment({ paymentId: 'payment', reverseAllocationIds: allocationIds }),
    ).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.paymentRepository.findById('payment'))?.status).toBe(PaymentStatus.Recorded)
    expect((await repositories.studentFeeRepository.findById(enrollment.id))?.allocatedAmount.amount).toBe(30000)
    expect(() => app.financeWorkflow.cancelPayment()).toThrow(/FINANCE_MODEL_REPLACED|fee model has been replaced/)
    expect((await repositories.paymentRepository.findById('payment'))?.status).toBe(PaymentStatus.Recorded)
    failSaveOnAttempt('studentFeeRepository')
    await expect(adjustStudentFee(app, {
      studentFeeId: enrollment.id,
      adjustmentAmount: 10000,
      reason: 'Adjustment',
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.studentFeeRepository.findById(enrollment.id))?.adjustmentAmount.amount).toBe(0)
    const remainingAllocationIds = (await app.financeWorkflow.getPaymentSettlementHistory({ accountId })).allocations.filter(allocation => allocation.causedByPaymentId === 'payment' && allocation.kind === 'settle').map(allocation => allocation.id)
    for (const allocationId of remainingAllocationIds)
      await app.financeWorkflow.reverseAllocation({ allocationId })
    failSaveOnAttempt('studentFeeRepository')
    await expect(cancelStudentFee(app, {
      studentFeeId: enrollment.id,
      reason: 'Cancellation',
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.studentFeeRepository.findById(enrollment.id))?.status).not.toBe(ChargeStatus.Cancelled)
  })

  it('rolls back report-card publication when the published result cannot be saved', async () => {
    const { app, repositories, failSaveOnAttempt } = await createTestApp()
    await saveSchool(app, { id: 'school', name: 'Edaya', timeZone: 'UTC', financeCurrency: 'XAF' })
    await app.setupWorkflow.createAcademicYear({
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
    await app.baseService.entities.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', label: 'G6', order: 6 }),
    )
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await saveStudent(app, { id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.studentWorkflow.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.baseService.entities.gradeScales.save(new GradeScale({
      id: 'gs-test',
      schoolId: 'school',
      name: 'Standard',
      minScore: 0,
      maxScore: 20,
      ranges: [{ letter: 'A', minScore: 0, maxScore: 20, isPassing: true }],
    }))
    await saveReportCardDefinition(app, {
      id: 'definition',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      gradeScaleId: 'gs-test',
      name: 'Grade 6 Standard',
      isDefault: true,
    })
    await publishAcademicPeriod(app, 'term')
    failSaveOnAttempt('reportCardResultRepository')
    await expect(app.assessmentsWorkflow.publishReportCardResult({
      id: 'report-card',
      studentId: 'student',
      periodId: 'term',
    })).rejects.toThrow('Simulated reportCardResultRepository save failure')
    expect(await repositories.reportCardResultRepository.findById('report-card')).toBeUndefined()
  })

  it('rolls back bulk attendance capture when a later roster entry is invalid', async () => {
    const { app, repositories } = await createTestApp()
    await saveSchool(app, { id: 'school', name: 'Edaya', timeZone: 'UTC', financeCurrency: 'XAF' })
    await app.setupWorkflow.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.baseService.entities.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', label: 'G6', order: 6 }),
    )
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await saveStudent(app, { id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.studentWorkflow.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.baseService.entities.subjects.save(
      new Subject({ id: 'general', schoolId: 'school', name: 'General' }),
    )
    const classSubject = await saveClassSubject(app, {
      id: 'class-general',
      classGroupId: 'class',
      subjectId: 'general',
    })
    await saveLessonSession(app, {
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      displayLabel: 'Class attendance',
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await expect(app.schedulingWorkflow.recordLessonSessionAttendance({
      lessonSessionId: 'lesson',
      attendanceByStudent: { student: AttendanceStatus.Present, missing: AttendanceStatus.Absent },
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    expect(await repositories.attendanceRepository.list({ lessonSessionId: 'lesson' })).toHaveLength(0)
  })

  it('rolls back materialized lesson sessions when a later occurrence save fails', async () => {
    const { app, repositories, failSaveOnAttempt } = await createTestApp()
    await saveSchool(app, { id: 'school', name: 'Edaya', timeZone: 'UTC', financeCurrency: 'XAF' })
    await app.setupWorkflow.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.baseService.entities.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', label: 'G6', order: 6 }),
    )
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.baseService.entities.subjects.save(
      new Subject({ id: 'math', schoolId: 'school', name: 'Mathematics' }),
    )
    const classSubject = await saveClassSubject(app, {
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
      gradeLevelSubjectId: 'gls-math',
    })
    await saveSchedule(app, {
      id: 'weekly-math',
      classGroupId: 'class',
      title: 'Math',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Monday,
      startTime: '08:00',
      endTime: '09:00',
      classSubjectId: classSubject.id,
    })
    failSaveOnAttempt('lessonSessionRepository', 2)
    await expect(app.schedulingWorkflow.materializeSchedule({ scheduleId: 'weekly-math' }))
      .rejects
      .toThrow('Simulated lessonSessionRepository save failure')
    expect(await repositories.lessonSessionRepository.list({ classGroupId: 'class' })).toHaveLength(0)
  })

  it('rolls back generated communications deliveries when a later recipient save fails', async () => {
    const { app, repositories, failSaveOnAttempt } = await createTestApp()
    await saveSchool(app, { id: 'school', name: 'Edaya', timeZone: 'UTC', financeCurrency: 'XAF' })
    await saveGuardian(app, { id: 'guardian-a', schoolId: 'school', firstName: 'Awa', lastName: 'Ba' })
    await saveGuardian(app, { id: 'guardian-b', schoolId: 'school', firstName: 'Mariama', lastName: 'Ba' })
    await app.accessControlWorkflow.linkActorSubject({ guardianId: 'guardian-a', subjectId: 'subject:guardian-a' })
    await app.accessControlWorkflow.linkActorSubject({ guardianId: 'guardian-b', subjectId: 'subject:guardian-b' })
    const publishedAt = new Date('2026-01-15T10:00:00Z')
    await saveAnnouncement(app, {
      id: 'announcement',
      schoolId: 'school',
      title: 'Reminder',
      content: 'Administrative reminder.',
      status: AnnouncementStatus.Draft,
    })
    await saveAnnouncementTarget(app, {
      id: 'all-guardians',
      announcementId: 'announcement',
      targetKind: AnnouncementTargetKind.AllGuardians,
    })
    await app.communicationsWorkflow.publishAnnouncement({ announcementId: 'announcement', publishedAt }, { deferNotifications: true })
    failSaveOnAttempt('messageDeliveryRepository', 2)
    await expect(app.communicationsWorkflow.dispatchPublishedAnnouncementNotifications('announcement'))
      .rejects
      .toThrow('Simulated messageDeliveryRepository save failure')
    expect(await repositories.messageDeliveryRepository.list({ announcementId: 'announcement' })).toHaveLength(0)
  })
})
