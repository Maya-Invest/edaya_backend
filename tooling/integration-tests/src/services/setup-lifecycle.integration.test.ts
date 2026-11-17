import { AcademicPeriodType, AttendanceMode, GradeLevel, withShortName } from '@edaya/core'
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
    await saveSchool(app, { id: 'school', name: 'EDaya', timeZone: 'UTC' })
    const school = await updateSchool(app, {
      schoolId: 'school',
      name: 'EDaya International School',
      shortName: 'EDaya',
      country: 'CM',
      city: 'Douala',
    })
    expect(school.name).toBe('EDaya International School')
    expect(school.shortName).toBe('EDaya')

    await app.setupWorkflow.createAcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setupWorkflow.createAcademicYear({
      id: 'year-2',
      schoolId: 'school',
      name: '2027-2028',
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2028-06-30T23:59:59Z'),
    })
    await app.setupWorkflow.publishAcademicYear({ academicYearId: 'year-1' })
    expect((await repositories.academicYearRepository.findById('year-2'))?.status).toBe('draft')

    const period = await createAcademicPeriod(app, {
      id: 'term',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await publishAcademicPeriod(app, 'term')

    await app.setupWorkflow.archiveAcademicYear({ academicYearId: 'year-1' })
    expect((await repositories.academicYearRepository.findById('year-1'))?.status).toBe('archived')
    await app.setupWorkflow.publishAcademicYear({ academicYearId: 'year-2' })

    await app.baseService.entities.gradeLevels.save(
      new GradeLevel(withShortName({ id: 'level', schoolId: 'school', name: 'Grade 6', shortName: 'G6', order: 6 })),
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

    await updateStaffStatus(app, 'teacher', false)
    await updateStaffStatus(app, 'teacher', true)
    // Later configuration changes must preserve earlier lifecycle and enrollment state.
    expect((await repositories.schoolRepository.findById('school'))?.name).toBe(school.name)
    expect((await repositories.academicYearRepository.findById('year-1'))?.status).toBe('archived')
    expect((await repositories.academicYearRepository.findById('year-2'))?.status).toBe('published')
    expect((await repositories.academicPeriodRepository.findById(period.id))?.isPublished).toBe(true)
    expect(await repositories.StudentClassEnrollmentRepository.findById('enrollment')).toBeDefined()
  })
})
