import { describe, expect, it } from 'bun:test'
import { AttendanceStatus, CalendarEvent, CalendarEventKind, DayOfWeek } from '../../../src/entities'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('scheduling attendance journey', () => {
  it('generates sessions around non-school days and summarizes bulk attendance updates', async () => {
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
    await app.students.registerStudent({ id: 'student-1', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.registerStudent({ id: 'student-2', schoolId: 'school', firstName: 'Omar', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment-1', studentId: 'student-1', classGroupId: 'class' })
    await app.students.enrollStudent({ id: 'enrollment-2', studentId: 'student-2', classGroupId: 'class' })
    await app.scheduling.createSchedule({
      id: 'weekly',
      classGroupId: 'class',
      title: 'Weekly advisory',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Tuesday,
      startTime: '08:00',
      endTime: '09:00',
    })
    await repositories.calendarEventRepository.save(new CalendarEvent({
      id: 'holiday',
      schoolId: 'school',
      academicYearId: 'year',
      title: 'Founders Day',
      startDate: new Date('2026-09-08T00:00:00'),
      endDate: new Date('2026-09-08T23:59:59'),
      kind: CalendarEventKind.Holiday,
      isNonSchoolDay: true,
    }))

    const sessions = await app.scheduling.generateSessions({
      classGroupId: 'class',
      startDate: new Date('2026-09-01T00:00:00'),
      endDate: new Date('2026-09-08T23:59:59'),
    })
    expect(sessions).toHaveLength(1)

    await app.scheduling.recordSessionAttendance({
      sessionId: sessions[0]!.id,
      attendanceByStudent: {
        'student-1': AttendanceStatus.Absent,
        'student-2': AttendanceStatus.Late,
      },
    })
    await app.scheduling.recordAttendance({
      id: 'ignored-replacement-id',
      studentId: 'student-1',
      sessionId: sessions[0]!.id,
      status: AttendanceStatus.Present,
    })

    const sessionAttendance = await app.scheduling.listSessionAttendance(sessions[0]!.id)
    const summary = await app.scheduling.buildAttendanceSummary({
      studentId: 'student-1',
      startDate: new Date('2026-09-01T00:00:00'),
      endDate: new Date('2026-09-30T23:59:59'),
    })
    expect(sessionAttendance).toHaveLength(2)
    expect(sessionAttendance.find(record => record.studentId === 'student-1')?.status).toBe(AttendanceStatus.Present)
    expect(summary.presentCount).toBe(1)
    expect(summary.absenceCount).toBe(0)
  })
})
