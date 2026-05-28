import { describe, expect, it } from 'bun:test'
import {
  EnrollmentEndReason,
  ProgressionDecision,
  StudentClassEnrollmentStatus,
  StudentStatus,
} from '../../../src/entities'
import { createTestApp } from '../../support/in-memory-school-headless-app'

async function arrangeEnrollment(
  app: ReturnType<typeof createTestApp>['app'],
  studentId = 'student',
  enrollmentId = 'enrollment',
  capacities: { class6?: number, class6b?: number, class7?: number } = {},
) {
  await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
  await app.setup.createAcademicYear({
    id: 'year-6',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T23:59:59Z'),
  })
  await app.setup.createAcademicYear({
    id: 'year-7',
    schoolId: 'school',
    name: '2027-2028',
    startDate: new Date('2027-09-01T00:00:00Z'),
    endDate: new Date('2028-06-30T23:59:59Z'),
  })
  await app.setup.createGradeLevel({ id: 'level-6', schoolId: 'school', name: 'Grade 6', order: 6 })
  await app.setup.createGradeLevel({ id: 'level-7', schoolId: 'school', name: 'Grade 7', order: 7 })
  await app.setup.createClassGroup({
    id: 'class-6',
    schoolId: 'school',
    academicYearId: 'year-6',
    gradeLevelId: 'level-6',
    name: 'Grade 6 A',
    capacity: capacities.class6,
  })
  await app.setup.createClassGroup({
    id: 'class-6-b',
    schoolId: 'school',
    academicYearId: 'year-6',
    gradeLevelId: 'level-6',
    name: 'Grade 6 B',
    capacity: capacities.class6b,
  })
  await app.setup.createClassGroup({
    id: 'class-7',
    schoolId: 'school',
    academicYearId: 'year-7',
    gradeLevelId: 'level-7',
    name: 'Grade 7 A',
    capacity: capacities.class7,
  })
  await app.students.registerStudent({ id: studentId, schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
  return app.students.enrollStudent({ id: enrollmentId, studentId, classGroupId: 'class-6' })
}

describe('student enrollment lifecycle', () => {
  it('promotes a student by closing the prior enrollment and linking an active successor', async () => {
    const { app, repositories } = createTestApp()
    await arrangeEnrollment(app)

    const successor = await app.students.promoteStudent({
      enrollmentId: 'enrollment',
      nextEnrollmentId: 'enrollment-next',
      nextClassGroupId: 'class-7',
      effectiveAt: new Date('2027-06-30T00:00:00Z'),
      decidedAt: new Date('2027-06-15T00:00:00Z'),
      notes: 'Promoted by end-of-year board',
    })
    const completed = await repositories.StudentClassEnrollmentRepository.findById('enrollment')

    expect(completed?.status).toBe(StudentClassEnrollmentStatus.Closed)
    expect(completed?.endReason).toBe(EnrollmentEndReason.Completed)
    expect(completed?.progressionDecision).toBe(ProgressionDecision.Promoted)
    expect(completed?.closedBy).toBe('admin')
    expect(completed?.progressionDecidedBy).toBe('admin')
    expect(successor.previousEnrollmentId).toBe('enrollment')
    expect(successor.classGroupId).toBe('class-7')
    expect(await repositories.StudentClassEnrollmentRepository.findActiveByStudent('student')).toEqual(successor)
  })

  it('transfers a student to a different class without recording progression', async () => {
    const { app, repositories } = createTestApp()
    await arrangeEnrollment(app)

    const successor = await app.students.transferStudent({
      enrollmentId: 'enrollment',
      nextEnrollmentId: 'transfer-enrollment',
      nextClassGroupId: 'class-6-b',
      effectiveAt: new Date('2026-10-01T00:00:00Z'),
    })
    const transferred = await repositories.StudentClassEnrollmentRepository.findById('enrollment')

    expect(transferred?.endReason).toBe(EnrollmentEndReason.Transferred)
    expect(transferred?.progressionDecision).toBeUndefined()
    expect(successor.previousEnrollmentId).toBe('enrollment')
    expect(successor.classGroupId).toBe('class-6-b')
    const currentClasses = await app.queries.listClassGroups({ schoolId: 'school', academicYearId: 'year-6' })
    expect(currentClasses.rows.find(row => row.classGroup.id === 'class-6')?.studentCount).toBe(0)
    expect(currentClasses.rows.find(row => row.classGroup.id === 'class-6-b')?.studentCount).toBe(1)
  })

  it('enforces class capacity during initial enrollment', async () => {
    const { app } = createTestApp()
    await arrangeEnrollment(app, 'student', 'enrollment', { class6: 1 })
    await app.students.registerStudent({ id: 'waiting', schoolId: 'school', firstName: 'Fatou', lastName: 'Sow' })

    await expect(app.students.enrollStudent({
      id: 'waiting-enrollment',
      studentId: 'waiting',
      classGroupId: 'class-6',
    })).rejects.toThrow('Class group class-6 has reached capacity')
  })

  it('enforces destination capacity for promotion and transfer without closing the source', async () => {
    const { app, repositories } = createTestApp()
    await arrangeEnrollment(app, 'student', 'enrollment', { class6b: 1, class7: 1 })
    await app.students.registerStudent({ id: 'occupant', schoolId: 'school', firstName: 'Moussa', lastName: 'Ba' })
    await app.students.enrollStudent({ id: 'occupant-class-7', studentId: 'occupant', classGroupId: 'class-7' })
    await app.students.registerStudent({ id: 'occupant-2', schoolId: 'school', firstName: 'Nafi', lastName: 'Sy' })
    await app.students.enrollStudent({ id: 'occupant-class-6-b', studentId: 'occupant-2', classGroupId: 'class-6-b' })

    await expect(app.students.promoteStudent({
      enrollmentId: 'enrollment',
      nextEnrollmentId: 'blocked-promotion',
      nextClassGroupId: 'class-7',
      effectiveAt: new Date('2027-06-30T00:00:00Z'),
    })).rejects.toThrow('Class group class-7 has reached capacity')
    await expect(app.students.transferStudent({
      enrollmentId: 'enrollment',
      nextEnrollmentId: 'blocked-transfer',
      nextClassGroupId: 'class-6-b',
      effectiveAt: new Date('2026-10-01T00:00:00Z'),
    })).rejects.toThrow('Class group class-6-b has reached capacity')

    expect((await repositories.StudentClassEnrollmentRepository.findById('enrollment'))?.status)
      .toBe(StudentClassEnrollmentStatus.Active)
  })

  it('rolls back a transfer when its successor cannot be saved', async () => {
    const { app, repositories, failSaveOnAttempt } = createTestApp()
    await arrangeEnrollment(app)
    failSaveOnAttempt('studentClassEnrollmentRepository', 2)

    await expect(app.students.transferStudent({
      enrollmentId: 'enrollment',
      nextEnrollmentId: 'failed-transfer',
      nextClassGroupId: 'class-6-b',
      effectiveAt: new Date('2026-10-01T00:00:00Z'),
    })).rejects.toThrow('Simulated studentClassEnrollmentRepository save failure')

    expect((await repositories.StudentClassEnrollmentRepository.findById('enrollment'))?.status)
      .toBe(StudentClassEnrollmentStatus.Active)
    expect(await repositories.StudentClassEnrollmentRepository.findById('failed-transfer')).toBeUndefined()
  })

  it('graduates a student while closing and auditing the completed enrollment', async () => {
    const { app, repositories } = createTestApp()
    await arrangeEnrollment(app)

    const completed = await app.students.graduateStudent({
      enrollmentId: 'enrollment',
      effectiveAt: new Date('2027-06-30T00:00:00Z'),
      notes: 'Graduation requirements met',
    })

    expect(completed.endReason).toBe(EnrollmentEndReason.Completed)
    expect(completed.progressionDecision).toBe(ProgressionDecision.Graduated)
    expect(completed.progressionDecidedBy).toBe('admin')
    expect((await repositories.studentRepository.findById('student'))?.status).toBe(StudentStatus.Graduated)
    expect(await repositories.StudentClassEnrollmentRepository.findActiveByStudent('student')).toBeUndefined()
    await expect(app.students.enrollStudent({
      id: 'post-graduation',
      studentId: 'student',
      classGroupId: 'class-7',
    })).rejects.toThrow('is not active and cannot be enrolled')
  })

  it('projects ordered enrollment history with resolved academic context after graduation', async () => {
    const { app } = createTestApp()
    await arrangeEnrollment(app)
    await app.students.promoteStudent({
      enrollmentId: 'enrollment',
      nextEnrollmentId: 'enrollment-next',
      nextClassGroupId: 'class-7',
      effectiveAt: new Date('2027-06-30T00:00:00Z'),
    })
    await app.students.graduateStudent({
      enrollmentId: 'enrollment-next',
      effectiveAt: new Date('2028-06-30T00:00:00Z'),
    })

    const history = await app.queries.getStudentEnrollmentHistory({
      schoolId: 'school',
      studentId: 'student',
    })

    expect(history.student.status).toBe(StudentStatus.Graduated)
    expect(history.currentEnrollment).toBeUndefined()
    expect(history.history.map(row => row.enrollment.id)).toEqual(['enrollment', 'enrollment-next'])
    expect(history.history.map(row => row.classGroup.id)).toEqual(['class-6', 'class-7'])
    expect(history.history.map(row => row.gradeLevel.id)).toEqual(['level-6', 'level-7'])
    expect(history.history.map(row => row.academicYear.id)).toEqual(['year-6', 'year-7'])
    expect(history.history[1]?.enrollment.previousEnrollmentId).toBe('enrollment')
  })

  it('records a decision only for a completed enrollment and does not overwrite it', async () => {
    const { app } = createTestApp()
    await arrangeEnrollment(app)
    await app.students.closeEnrollment({
      enrollmentId: 'enrollment',
      endReason: EnrollmentEndReason.Completed,
      endedAt: new Date('2027-06-30T00:00:00Z'),
    })
    const retained = await app.students.recordProgressionDecision({
      enrollmentId: 'enrollment',
      decision: ProgressionDecision.Retained,
      decidedAt: new Date('2027-07-01T00:00:00Z'),
    })

    expect(retained.progressionDecision).toBe(ProgressionDecision.Retained)
    await expect(app.students.recordProgressionDecision({
      enrollmentId: 'enrollment',
      decision: ProgressionDecision.Promoted,
    })).rejects.toThrow('already has a progression decision')
  })

  it('rejects progression decisions for enrollments closed without completion', async () => {
    const { app } = createTestApp()
    await arrangeEnrollment(app)
    await app.students.closeEnrollment({
      enrollmentId: 'enrollment',
      endReason: EnrollmentEndReason.Withdrawn,
      endedAt: new Date('2026-10-01T00:00:00Z'),
    })

    await expect(app.students.recordProgressionDecision({
      enrollmentId: 'enrollment',
      decision: ProgressionDecision.Retained,
    })).rejects.toThrow('a progression decision requires a completed enrollment')
  })

  it('rejects a transition that would overwrite an existing enrollment identity', async () => {
    const { app, repositories } = createTestApp()
    await arrangeEnrollment(app)

    await expect(app.students.promoteStudent({
      enrollmentId: 'enrollment',
      nextEnrollmentId: 'enrollment',
      nextClassGroupId: 'class-7',
      effectiveAt: new Date('2027-06-30T00:00:00Z'),
    })).rejects.toThrow('Enrollment id enrollment already exists')

    expect((await repositories.StudentClassEnrollmentRepository.findById('enrollment'))?.status)
      .toBe(StudentClassEnrollmentStatus.Active)
  })
})
