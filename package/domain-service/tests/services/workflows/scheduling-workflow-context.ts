import type { ActivitySession, AttendanceRecord, CalendarEventInput, NotificationGatewayPort, ScheduleInput } from '@edaya/core'
import { AcademicYear, Activity, ActivityCategory, Attendance, AttendanceMode, CalendarEvent, ClassGroup, ClassSubject, DayOfWeek, GradeLevel, Guardian, GuardianStudentLink, LessonSession, noOpNotificationGateway, Schedule, ScheduleKind, School, StaffMember, Student, StudentClassEnrollment, Subject } from '@edaya/core'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

export async function createSchedulingContext({ classGroupAttendanceMode = AttendanceMode.Daily, existingAttendance, existingDailyAttendance = false, activeEnrollment = true, schedules = [], calendarEvents = [], academicYear = { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }, enforceScheduleConflicts = false, extraLessonSessions = {}, extraActivitySessions = {}, notificationGateway = noOpNotificationGateway }: { classGroupAttendanceMode?: AttendanceMode, existingAttendance?: AttendanceRecord, existingDailyAttendance?: boolean, activeEnrollment?: boolean, schedules?: ScheduleInput[], calendarEvents?: CalendarEventInput[], academicYear?: { startDate: Date, endDate: Date }, enforceScheduleConflicts?: boolean, extraLessonSessions?: Record<string, LessonSession>, extraActivitySessions?: Record<string, ActivitySession>, notificationGateway?: NotificationGatewayPort } = {}) {
  const actor = createTestStaffActor('sch1', 'user1')
  const fixture = await createTestApp(actor, { owner: true, notificationGateway })
  const repositories = fixture.schoolRepositories
  await repositories.schools.save(new School({ id: 'sch1', name: 'School', timeZone: 'UTC', ownerSubjectId: actor.subjectId, enforceScheduleConflicts }))
  await repositories.academicYears.save(new AcademicYear({ id: 'ay1', schoolId: 'sch1', name: 'Year', ...academicYear, status: 'published' }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'grade1', schoolId: 'sch1', name: 'Grade', label: 'G', order: 1 }))
  for (const [id, attendanceMode] of [['cg_daily', classGroupAttendanceMode], ['cg_session', AttendanceMode.Session]] as const) await repositories.classGroups.save(new ClassGroup({ id, schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', name: id, attendanceMode }))
  for (const [id, name] of [['cs1', 'Math'], ['cs2', 'Science lab'], ['cs3', 'History']] as const) {
    await repositories.subjects.save(new Subject({ gradeLevelId: 'grade1', academicYearId: 'ay1', id: `subj-${id}`, schoolId: 'sch1', name }))
    await repositories.classSubjects.save(new ClassSubject({ id, classGroupId: 'cg_daily', subjectId: `subj-${id}` }))
  }
  await repositories.activities.save(new Activity({ id: 'act1', schoolId: 'sch1', name: 'Chess Club', category: ActivityCategory.Arts, coach: 'Coach', schedule: 'Thursday', description: 'Chess', participants: 0, capacity: 30, startDate: academicYear.startDate, endDate: academicYear.endDate }))
  for (const input of [{ id: 'sched-1', schoolId: 'sch1', classGroupId: 'cg_daily', classSubjectId: 'cs1', scheduleKind: ScheduleKind.Lesson, title: 'Math', isRecurring: true, dayOfWeek: DayOfWeek.Thursday, startTime: '08:00', endTime: '09:00' }, { id: 'sched-chess', schoolId: 'sch1', classGroupId: 'cg_daily', activityId: 'act1', scheduleKind: ScheduleKind.Activity, title: 'Chess', isRecurring: true, dayOfWeek: DayOfWeek.Thursday, startTime: '15:00', endTime: '16:00' }, { id: 'sched-other', schoolId: 'sch1', classGroupId: 'cg_daily', classSubjectId: 'cs2', scheduleKind: ScheduleKind.Lesson, title: 'Science', isRecurring: true, dayOfWeek: DayOfWeek.Thursday, startTime: '08:30', endTime: '09:30' }, ...schedules]) await repositories.schedules.save(new Schedule(input))
  await repositories.lessonSessions.save(new LessonSession({ id: 'ses1', schoolId: 'sch1', classGroupId: 'cg_daily', scheduleId: 'sched-1', classSubjectId: 'cs1', displayLabel: 'Math', startsAt: new Date('2026-05-28T08:00:00Z'), endsAt: new Date('2026-05-28T09:00:00Z') }))
  for (const session of Object.values(extraLessonSessions)) await repositories.lessonSessions.save(session)
  for (const session of Object.values(extraActivitySessions)) await repositories.activitySessions.save(session)
  for (const event of calendarEvents) await repositories.calendarEvents.save(new CalendarEvent(event))
  await repositories.students.save(new Student({ id: 'stu1', schoolId: 'sch1', firstName: 'Student', lastName: 'One', subjectId: 'subject:stu1' }))
  await repositories.guardians.save(new Guardian({ id: 'gua1', schoolId: 'sch1', firstName: 'Grace', lastName: 'Hopper', subjectId: 'subject:gua1' }))
  await repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link', schoolId: 'sch1', guardianId: 'gua1', studentId: 'stu1', relationship: 'parent' }))
  await repositories.staffMembers.save(new StaffMember({ id: 'staff1', schoolId: 'sch1', firstName: 'Reviewer', lastName: 'One' }))
  if (activeEnrollment)
    await repositories.enrollments.save(new StudentClassEnrollment({ id: 'enr1', studentId: 'stu1', classGroupId: 'cg_daily', academicYearId: 'ay1', enrollmentIndex: 1 }))
  if (existingDailyAttendance)
    await repositories.attendances.save(new Attendance({ id: 'cg_daily:2026-05-28', schoolId: 'sch1', classGroupId: 'cg_daily', displayLabel: 'Daily attendance', startsAt: new Date('2026-05-28'), endsAt: new Date('2026-05-29') }))
  if (existingAttendance)
    await repositories.attendance.save(existingAttendance)
  return { ...fixture, repositories, service: fixture.app, lessonSessions: repositories.lessonSessions, activitySessions: repositories.activitySessions, attendances: repositories.attendances }
}
