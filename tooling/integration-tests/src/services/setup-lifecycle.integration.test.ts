import {
  AcademicPeriodType,
  AttendanceMode,
  GradeLevel,
  SchoolType,
} from '@edaya/core'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import {
  createAcademicPeriod,
  createClassGroup,
  publishAcademicPeriod,
  saveSchool,
  saveStaffMember,
  saveStudent,
  updateClassGroup,
  updateSchool,
  updateStaffStatus,
} from '../utils/core-service-helpers'
import { createTestApp } from '../utils/test-adapter'

describeIntegration('setup lifecycle journey', () => {
  it('updates school and class configuration, active year, periods, and staff status', async () => {
    const { app, repositories } = await createTestApp()
    await saveSchool(app, { id: 'school', name: 'Edaya', timeZone: 'UTC' })
    const school = await updateSchool(app, {
      schoolId: 'school',
      name: 'Edaya International School',
      type: SchoolType.K12,
      country: 'CM',
      city: 'Douala',
    })
    expect(school.name).toBe('Edaya International School')
    expect(school.type).toBe(SchoolType.K12)

    await app.setupWorkflow.createAcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    const activeYear = await app.setupWorkflow.createAcademicYear({
      id: 'year-2',
      schoolId: 'school',
      name: '2027-2028',
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2028-06-30T23:59:59Z'),
    })
    expect(activeYear.isActive).toBe(true)
    expect((await repositories.academicYearRepository.findById('year-1'))?.isActive).toBe(false)
    const reactivatedYear = await app.setupWorkflow.activateAcademicYear({ academicYearId: 'year-1' })
    expect(reactivatedYear.isActive).toBe(true)
    expect((await repositories.academicYearRepository.findById('year-2'))?.isActive).toBe(false)

    const period = await createAcademicPeriod(app, {
      id: 'term',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    expect(period.isPublished).toBe(false)
    expect((await publishAcademicPeriod(app, 'term')).isPublished).toBe(true)

    await app.baseService.entities.gradeLevels.save(
      new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 }),
    )
    await saveStaffMember(app, {
      id: 'teacher',
      schoolId: 'school',
      firstName: 'Binta',
      lastName: 'Sow',
    })
    await createClassGroup(app, {
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
      capacity: 2,
    })
    await saveStudent(app, { id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.studentWorkflow.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await expect(updateClassGroup(app, {
      classGroupId: 'class',
      capacity: 0,
    })).rejects.toThrow('capacity must be a strictly positive integer')
    const classGroup = await updateClassGroup(app, {
      classGroupId: 'class',
      name: 'Grade 6 Alpha',
      capacity: 3,
      attendanceMode: AttendanceMode.Daily,
      homeroomStaffId: 'teacher',
    })
    expect(classGroup.name).toBe('Grade 6 Alpha')
    expect(classGroup.capacity).toBe(3)
    expect(classGroup.attendanceMode).toBe(AttendanceMode.Daily)
    expect(classGroup.homeroomStaffId).toBe('teacher')

    expect((await updateStaffStatus(app, 'teacher', false)).isActive).toBe(false)
    expect((await updateStaffStatus(app, 'teacher', true)).isActive).toBe(true)
    await expect(updateStaffStatus(app, 'admin', false))
      .rejects
      .toThrow('Transfer school ownership before deactivating the owner')
  })
})
