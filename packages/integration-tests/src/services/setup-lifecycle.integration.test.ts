import { describe, expect, it } from 'bun:test'
import {
  AcademicPeriodType,
  AttendanceMode,
  SchoolType,
  StaffRole,
} from '@edaya/core'
import { createTestApp } from '../support/in-memory-school-headless-app'

describe('setup lifecycle journey', () => {
  it('updates school and class configuration, active year, periods, and staff status', async () => {
    const { app, repositories } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
    const school = await app.setup.updateSchoolConfiguration({
      schoolId: 'school',
      name: 'Maya International School',
      type: SchoolType.K12,
      country: 'CM',
      city: 'Douala',
    })
    expect(school.name).toBe('Maya International School')
    expect(school.type).toBe(SchoolType.K12)

    await app.setup.createAcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    const activeYear = await app.setup.createAcademicYear({
      id: 'year-2',
      schoolId: 'school',
      name: '2027-2028',
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2028-06-30T23:59:59Z'),
    })
    expect(activeYear.isActive).toBe(true)
    expect((await repositories.academicYearRepository.findById('year-1'))?.isActive).toBe(false)
    const reactivatedYear = await app.setup.activateAcademicYear({ academicYearId: 'year-1' })
    expect(reactivatedYear.isActive).toBe(true)
    expect((await repositories.academicYearRepository.findById('year-2'))?.isActive).toBe(false)

    const period = await app.setup.createAcademicPeriod({
      id: 'term',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    expect(period.isPublished).toBe(false)
    expect((await app.setup.publishAcademicPeriod({ academicPeriodId: 'term' })).isPublished).toBe(true)

    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.registerStaffMember({
      id: 'teacher',
      schoolId: 'school',
      firstName: 'Binta',
      lastName: 'Sow',
      roles: [StaffRole.Teacher],
    })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
      capacity: 2,
    })
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await expect(app.setup.updateClassGroupConfiguration({
      classGroupId: 'class',
      capacity: 0,
    })).rejects.toThrow('capacity cannot be below current active enrollment count')
    const classGroup = await app.setup.updateClassGroupConfiguration({
      classGroupId: 'class',
      name: 'Grade 6 Alpha',
      capacity: 3,
      attendanceMode: AttendanceMode.Session,
      homeroomStaffId: 'teacher',
    })
    expect(classGroup.name).toBe('Grade 6 Alpha')
    expect(classGroup.capacity).toBe(3)
    expect(classGroup.homeroomStaffId).toBe('teacher')

    expect((await app.setup.updateStaffMemberStatus({ staffId: 'teacher', isActive: false })).isActive).toBe(false)
    expect((await app.setup.updateStaffMemberStatus({ staffId: 'teacher', isActive: true })).isActive).toBe(true)
    await expect(app.setup.updateStaffMemberStatus({ staffId: 'admin', isActive: false }))
      .rejects
      .toThrow('cannot deactivate their own account')
  })
})
