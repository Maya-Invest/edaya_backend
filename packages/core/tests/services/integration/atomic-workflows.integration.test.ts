import { describe, expect, it } from 'bun:test'
import { AcademicPeriodType, AttendanceStatus, PaymentMethod, PaymentStatus, SessionKind } from '../../../src/entities'
import { AuthorizationErrorCode } from '../../../src/services/authorization'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('atomic workflow safeguards', () => {
  it('rolls back curriculum progress when a later aggregate write fails', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
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
    await app.scheduling.createSession({
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
    await expect(app.academics.recordSessionProgress({
      id: 'progress',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson',
      completedPercentage: 50,
    })).rejects.toThrow('Simulated classSubjectMatterRepository save failure')
    expect(await app.academics.listMatterProgress(classMatter.id)).toHaveLength(0)
    expect((await repositories.classSubjectMatterRepository.findById(classMatter.id))?.completedPercentage).toBe(0)
    expect((await repositories.classSubjectRepository.findById(classSubject.id))?.completedPercentage).toBe(0)
  })

  it('rolls back payment recording and reversal when balance updates fail', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
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
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })
    failSaveOnAttempt('studentFeeRepository')
    await expect(app.finance.recordPayment({
      id: 'payment',
      studentFeeId: studentFee.id,
      amount: 30000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect(await repositories.paymentRepository.findById('payment')).toBeUndefined()
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.paidAmount.amount).toBe(0)
    await app.finance.recordPayment({
      id: 'payment',
      studentFeeId: studentFee.id,
      amount: 30000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    failSaveOnAttempt('studentFeeRepository')
    await expect(
      app.finance.reversePayment({ paymentId: 'payment' }),
    ).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.paymentRepository.findById('payment'))?.status).toBe(PaymentStatus.Recorded)
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.paidAmount.amount).toBe(30000)
  })

  it('rolls back report-card publication when the published result cannot be saved', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
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
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.assessments.createReportCardDefinition({
      id: 'definition',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 Standard',
      isDefault: true,
    })
    failSaveOnAttempt('reportCardResultRepository', 2)
    await expect(app.assessments.publishReportCardResult({
      id: 'report-card',
      studentId: 'student',
      periodId: 'term',
    })).rejects.toThrow('Simulated reportCardResultRepository save failure')
    expect(await repositories.reportCardResultRepository.findById('report-card')).toBeUndefined()
  })

  it('rolls back bulk attendance capture when a later roster entry is invalid', async () => {
    const { app, repositories } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
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
    await app.scheduling.createSession({
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      title: 'Class attendance',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await expect(app.scheduling.recordSessionAttendance({
      sessionId: 'lesson',
      attendanceByStudent: { student: AttendanceStatus.Present, missing: AttendanceStatus.Absent },
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    expect(await repositories.attendanceRepository.list({ sessionId: 'lesson' })).toHaveLength(0)
  })

  it('rolls back generated sessions when materializing a later schedule fails', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
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
    const sessionDate = new Date('2026-09-01T00:00:00Z')
    for (const [id, title, startTime, endTime] of [
      ['morning', 'Morning', '08:00', '09:00'],
      ['afternoon', 'Afternoon', '13:00', '14:00'],
    ] as const) {
      await app.scheduling.createSchedule({
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
    await expect(app.scheduling.generateSessions({
      classGroupId: 'class',
      startDate: sessionDate,
      endDate: sessionDate,
    })).rejects.toThrow('Simulated sessionRepository save failure')
    expect(await repositories.sessionRepository.list({ classGroupId: 'class' })).toHaveLength(0)
  })
})
