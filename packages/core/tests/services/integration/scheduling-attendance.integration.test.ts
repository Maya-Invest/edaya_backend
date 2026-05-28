import { describe, expect, it } from 'bun:test'
import {
  AttendanceJustificationStatus,
  AttendanceMode,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  DayOfWeek,
  EnrollmentEndReason,
} from '../../../src/entities'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('scheduling attendance journey', () => {
  it('records daily attendance for classes configured for primary-style attendance', async () => {
    const { app, repositories } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 1', order: 1 })
    await app.setup.createClassGroup({
      id: 'primary-class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 1 A',
      attendanceMode: AttendanceMode.Daily,
    })
    await app.students.registerStudent({ id: 'student-1', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.registerStudent({ id: 'student-2', schoolId: 'school', firstName: 'Omar', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment-1', studentId: 'student-1', classGroupId: 'primary-class' })
    await app.students.enrollStudent({ id: 'enrollment-2', studentId: 'student-2', classGroupId: 'primary-class' })

    const emptyReview = await app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      classGroupId: 'primary-class',
      date: new Date('2026-09-02T12:00:00Z'),
    })
    expect(emptyReview.selectedSession).toBeUndefined()
    expect(emptyReview.rows.map(row => `${row.student.id}:${row.status}`)).toEqual([
      'student-1:present',
      'student-2:present',
    ])

    const records = await app.scheduling.recordClassDailyAttendance({
      classGroupId: 'primary-class',
      date: new Date('2026-09-02T12:00:00Z'),
      attendanceByStudent: {
        'student-1': AttendanceStatus.Absent,
        'student-2': AttendanceStatus.Present,
      },
      createdAt: new Date('2026-09-02T07:00:00Z'),
    })
    expect(records).toHaveLength(2)
    expect(records[0]?.sessionId).toBe('daily:primary-class:2026-09-02')
    expect(await repositories.sessionRepository.findById('daily:primary-class:2026-09-02')).toBeDefined()

    const corrected = await app.scheduling.recordDailyAttendance({
      id: 'ignored-daily-id',
      classGroupId: 'primary-class',
      studentId: 'student-1',
      date: new Date('2026-09-02T00:00:00Z'),
      status: AttendanceStatus.Late,
      createdAt: new Date('2026-09-02T08:00:00Z'),
    })
    expect(corrected.id).toBe('student-1-daily:primary-class:2026-09-02')
    expect(corrected.status).toBe(AttendanceStatus.Late)
    expect(corrected.correctedByStaffId).toBe('admin')

    const review = await app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      classGroupId: 'primary-class',
      date: new Date('2026-09-02T00:00:00Z'),
    })
    expect(review.selectedSession?.id).toBe('daily:primary-class:2026-09-02')
    expect(review.summary).toEqual({ present: 1, absent: 0, excusedAbsent: 0, late: 1, total: 2 })
    expect((await app.scheduling.buildAttendanceSummary({
      studentId: 'student-1',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-09-30T23:59:59Z'),
    })).lateCount).toBe(1)
  })

  it('generates sessions around non-school days and summarizes bulk attendance updates', async () => {
    const { app } = createTestApp()
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
    await app.scheduling.createCalendarEvent({
      id: 'holiday',
      schoolId: 'school',
      academicYearId: 'year',
      title: 'Founders Day',
      startDate: new Date('2026-09-08T00:00:00'),
      endDate: new Date('2026-09-08T23:59:59'),
      kind: CalendarEventKind.Holiday,
      isNonSchoolDay: true,
    })
    const calendar = await app.queries.getCalendarEvents({ schoolId: 'school', academicYearId: 'year' })
    expect(calendar.events.map(event => event.id)).toEqual(['holiday'])

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
    expect(sessionAttendance.find(record => record.studentId === 'student-1')?.correctedByStaffId).toBe('admin')
    expect(summary.presentCount).toBe(1)
    expect(summary.absenceCount).toBe(0)
    await expect(app.scheduling.reviewAttendanceJustification({
      studentId: 'student-1',
      sessionId: sessions[0]!.id,
      decision: AttendanceJustificationStatus.Excused,
      reason: 'Invalid review',
    })).rejects.toThrow('Only an absent attendance record')

    await app.students.closeEnrollment({
      enrollmentId: 'enrollment-1',
      endReason: EnrollmentEndReason.Withdrawn,
      endedAt: new Date('2026-09-09T00:00:00Z'),
    })
    await expect(app.scheduling.recordAttendance({
      id: 'post-withdrawal',
      studentId: 'student-1',
      sessionId: sessions[0]!.id,
      status: AttendanceStatus.Absent,
    })).rejects.toThrow('does not have an active enrollment')
    const review = await app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      classGroupId: 'class',
      date: sessions[0]!.startsAt,
      sessionId: sessions[0]!.id,
    })
    expect(review.rows.map(row => row.student.id)).toEqual(['student-2'])
  })

  it('applies scoped closures only to affected classes and counts excused absences explicitly', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    for (const id of ['closed-class', 'open-class']) {
      await app.setup.createClassGroup({
        id,
        schoolId: 'school',
        academicYearId: 'year',
        gradeLevelId: 'level',
        name: id,
      })
      await app.scheduling.createSchedule({
        id: `${id}-weekly`,
        classGroupId: id,
        title: 'Advisory',
        isRecurring: true,
        dayOfWeek: DayOfWeek.Tuesday,
        startTime: '08:00',
        endTime: '09:00',
      })
    }
    await app.scheduling.createCalendarEvent({
      id: 'class-closure',
      schoolId: 'school',
      academicYearId: 'year',
      title: 'Class closure',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-09-01T23:59:59Z'),
      kind: CalendarEventKind.Event,
      isNonSchoolDay: true,
      scopeKind: CalendarEventScopeKind.ClassGroup,
      scopeId: 'closed-class',
    })
    await app.scheduling.createCalendarEvent({
      id: 'grade-event',
      schoolId: 'school',
      academicYearId: 'year',
      title: 'Grade gathering',
      startDate: new Date('2026-09-02T00:00:00Z'),
      endDate: new Date('2026-09-02T23:59:59Z'),
      kind: CalendarEventKind.Event,
      scopeKind: CalendarEventScopeKind.GradeLevel,
      scopeId: 'level',
    })
    expect((await app.queries.getCalendarEvents({
      schoolId: 'school',
      academicYearId: 'year',
      classGroupId: 'closed-class',
    })).events.map(event => event.id)).toEqual(['class-closure', 'grade-event'])
    expect((await app.queries.getCalendarEvents({
      schoolId: 'school',
      academicYearId: 'year',
      classGroupId: 'open-class',
    })).events.map(event => event.id)).toEqual(['grade-event'])
    expect(await app.scheduling.generateSessions({
      classGroupId: 'closed-class',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-09-01T23:59:59Z'),
    })).toHaveLength(0)
    const openSessions = await app.scheduling.generateSessions({
      classGroupId: 'open-class',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-09-01T23:59:59Z'),
    })
    expect(openSessions).toHaveLength(1)
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'open-class' })
    await app.scheduling.recordAttendance({
      id: 'excused-absence',
      studentId: 'student',
      sessionId: openSessions[0]!.id,
      status: AttendanceStatus.Absent,
    })
    const reviewed = await app.scheduling.reviewAttendanceJustification({
      studentId: 'student',
      sessionId: openSessions[0]!.id,
      decision: AttendanceJustificationStatus.Excused,
      reason: 'Medical appointment',
      notes: 'Documentation verified',
      reviewedAt: new Date('2026-09-02T00:00:00Z'),
    })
    expect(reviewed.justificationStatus).toBe(AttendanceJustificationStatus.Excused)
    expect(reviewed.justifiedByStaffId).toBe('admin')
    await expect(app.scheduling.reviewAttendanceJustification({
      studentId: 'student',
      sessionId: openSessions[0]!.id,
      decision: AttendanceJustificationStatus.Rejected,
      reason: 'Attempted second review',
    })).rejects.toThrow('Attendance justification has already been reviewed')
    await expect(app.scheduling.recordAttendance({
      id: 'correct-reviewed-absence',
      studentId: 'student',
      sessionId: openSessions[0]!.id,
      status: AttendanceStatus.Present,
    })).rejects.toThrow('Reviewed attendance must not be corrected')
    const review = await app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      classGroupId: 'open-class',
      date: openSessions[0]!.startsAt,
      sessionId: openSessions[0]!.id,
    })
    expect(review.rows[0]?.record?.reason).toBe('Medical appointment')
    expect(review.rows[0]?.record?.notes).toBe('Documentation verified')
    expect(review.summary.excusedAbsent).toBe(1)
    const summary = await app.scheduling.buildAttendanceSummary({
      studentId: 'student',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-09-01T23:59:59Z'),
    })
    expect(summary.absenceCount).toBe(1)
    expect(summary.excusedAbsenceCount).toBe(1)
    expect(summary.total).toBe(1)
  })
})
