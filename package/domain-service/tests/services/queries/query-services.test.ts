import { AuthorizationError, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { CalendarEvent, CalendarEventKind, CalendarEventScopeKind, CatalogService, CatalogServiceCategory, CatalogServiceStatus, ChargeStatus, DayOfWeek, LessonSession, noOpNotificationGateway, PeriodDefinition, Permission, StaffPermissionAssignment, StudentCharge, StudentServiceEnrollment, Teacher } from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { testFileStorage } from '../../support/test-file-storage'

describe('SchoolService aggregate and timetable queries', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE schools SET finance_currency = \'XOF\' WHERE id = \'school-a\'')
    service = new SchoolService({ actor: createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', requestId: 'query', authenticatedAt: new Date() }), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
  })
  afterEach(async () => {
    await fixture.db.close()
  })

  test('fee aggregate uses the same student scope as lists and single records, with live revocation', async () => {
    await fixture.repositories.catalogServices.save(new CatalogService({
      id: 'fee',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      name: 'Tuition',
      currency: 'XOF',
      defaultPrice: 100,
      billingTerms: { kind: 'one_time', installments: [] },
      status: CatalogServiceStatus.Active,
    }))
    for (const id of ['student-a', 'student-other']) {
      await fixture.repositories.studentServiceEnrollments.save(new StudentServiceEnrollment({
        id: `enr-${id}`,
        schoolId: 'school-a',
        studentId: id,
        catalogServiceId: 'fee',
        academicYearId: 'year-a',
        acceptedTerms: {
          catalogServiceId: 'fee',
          name: 'Tuition',
          category: CatalogServiceCategory.Tuition,
          currency: 'XOF',
          price: 100,
          billingKind: 'one_time',
          billingTerms: { kind: 'one_time', installments: [] },
        },
      }))
      await fixture.repositories.studentCharges.save(new StudentCharge({
        id,
        schoolId: 'school-a',
        studentId: id,
        enrollmentId: `enr-${id}`,
        academicYearId: 'year-a',
        label: 'Tuition',
        currency: 'XOF',
        expectedAmount: 100,
        allocatedAmount: 0,
        status: ChargeStatus.Overdue,
        dueDate: new Date('2026-01-01'),
        installments: [{
          id: `${id}-due`,
          label: 'Tuition',
          expectedAmount: 100,
          dueDate: new Date('2026-01-01'),
        }],
      }))
    }
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'fee-reader', staffId: 'staff-a', schoolId: 'school-a', academicYearId: 'year-a', permission: Permission.QUERY_OVERDUE_FEES_READ, scopes: [{ kind: 'student', studentId: 'student-a' }] }))
    expect(await service.getOverdueFeeCount('school-a')).toBe(1)
    await expect(service.getOverdueFeeCount('school-b')).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.staffPermissionAssignments.delete('fee-reader')
    await expect(service.getOverdueFeeCount('school-a')).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('overview requires its own school action and rejects cross-school parameters', async () => {
    const input = { schoolId: 'school-a', academicYearId: 'year-a', academicPeriodId: 'period-a', referenceDate: new Date('2026-05-01') }
    await expect(service.getSchoolOverview(input)).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'overview', staffId: 'staff-a', schoolId: 'school-a', academicYearId: 'year-a', permission: Permission.QUERY_OVERVIEW_READ, scopes: [{ kind: 'school' }] }))
    expect((await service.getSchoolOverview(input)).kpis.studentCount).toBe(2)
    await expect(service.getSchoolOverview({ ...input, schoolId: 'school-b' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.getPublishedReportCardCount('school-a')).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('overview and shell counts reject foreign years, periods and class ids before aggregation', async () => {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'overview', staffId: 'staff-a', schoolId: 'school-a', academicYearId: 'year-a', permission: Permission.QUERY_OVERVIEW_READ, scopes: [{ kind: 'school' }] }))
    const input = { schoolId: 'school-a', academicYearId: 'year-a', academicPeriodId: 'period-a' }
    await expect(service.getSchoolOverview({ ...input, academicYearId: 'year-b', academicPeriodId: 'period-b' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.getSchoolOverview({ ...input, academicPeriodId: 'period-b' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.getAppShellCounts({ schoolId: 'school-a', classGroupIds: ['class-a', 'class-b'] })).rejects.toBeInstanceOf(AuthorizationError)
    const counts = await service.getAppShellCounts({ schoolId: 'school-a', classGroupIds: ['class-a'] })
    expect(counts.studentCount).toBe(2)
    expect(counts.teacherCount).toBe(1)
    expect(counts.activeEnrollmentCountsByClass).toEqual({ 'class-a': 1 })
  })

  test('timetable authorization covers the class and its events and rejects missing or unrelated classes', async () => {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'timetable', staffId: 'staff-a', schoolId: 'school-a', academicYearId: 'year-a', permission: Permission.QUERY_TIMETABLE_READ, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    const input = { classGroupId: 'class-a', startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31') }
    const result = await service.getClassGroupTimetable(input)
    expect(result.classGroupId).toBe('class-a')
    expect(result.events).toEqual([])
    for (const classGroupId of ['missing', 'class-other', 'class-b'])
      await expect(service.getClassGroupTimetable({ ...input, classGroupId })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('teacher timetable authorization filters assigned sessions and rejects other teachers and family actors', async () => {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'timetable', staffId: 'staff-a', schoolId: 'school-a', academicYearId: 'year-a', permission: Permission.QUERY_TIMETABLE_READ, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    await fixture.repositories.lessonSessions.save(new LessonSession({
      id: 'math-session',
      schoolId: 'school-a',
      classGroupId: 'class-a',
      classSubjectId: 'math-a',
      displayLabel: 'Math',
      startsAt: new Date('2026-05-01T10:00:00Z'),
      endsAt: new Date('2026-05-01T11:00:00Z'),
      timetableGenerated: true,
      timetableTeacherIds: ['teacher-a'],
    }))
    await fixture.repositories.lessonSessions.save(new LessonSession({
      id: 'other-session',
      schoolId: 'school-a',
      classGroupId: 'class-other',
      classSubjectId: 'math-other',
      displayLabel: 'Other',
      startsAt: new Date('2026-05-01T10:00:00Z'),
      endsAt: new Date('2026-05-01T11:00:00Z'),
      timetableGenerated: true,
      timetableTeacherIds: ['teacher-a'],
    }))
    const input = { teacherId: 'teacher-a', startDate: new Date('2026-05-01'), endDate: new Date('2026-05-01') }
    expect((await service.getTeacherTimetable(input)).events.map(event => event.id)).toEqual(['math-session'])
    await expect(service.getTeacherTimetable({ ...input, teacherId: 'missing' })).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.teachers.save(new Teacher({ id: 'teacher-b', schoolId: 'school-a', firstName: 'B', lastName: 'Teacher' }))

    const identity = { schoolId: 'school-a', subjectId: 'person-a', requestId: 'teacher-timetable', authenticatedAt: new Date() }
    const teacherService = new SchoolService({ actor: createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' }), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    expect((await teacherService.getTeacherTimetable(input)).events.map(event => event.id)).toEqual(['math-session'])
    await expect(teacherService.getTeacherTimetable({ ...input, teacherId: 'teacher-b' })).rejects.toBeInstanceOf(AuthorizationError)

    const guardianService = new SchoolService({ actor: createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    await expect(guardianService.getTeacherTimetable(input)).rejects.toBeInstanceOf(AuthorizationError)
    const classInput = { classGroupId: 'class-a', startDate: input.startDate, endDate: input.endDate }
    expect((await guardianService.getClassGroupTimetable(classInput)).events.map(event => event.id)).toEqual(['math-session'])
    await fixture.db.exec('UPDATE students SET subject_id = \'person-a\' WHERE id = \'student-a\'')
    const studentService = new SchoolService({ actor: createStudentActorMetadata({ ...identity, studentId: 'student-a' }), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    expect((await studentService.getClassGroupTimetable(classInput)).events.map(event => event.id)).toEqual(['math-session'])
    await expect(guardianService.getClassGroupTimetable({ ...classInput, classGroupId: 'class-other' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test.each(['staff', 'teacher', 'guardian', 'student'] as const)('%s availability scopes supporting reads before building cells', async (kind) => {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'space', staffId: 'staff-a', schoolId: 'school-a', academicYearId: 'year-a', permission: Permission.QUERY_TIMETABLE_READ, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    await fixture.db.exec('UPDATE students SET subject_id = \'person-a\' WHERE id = \'student-a\'')
    const identity = { schoolId: 'school-a', subjectId: 'person-a', requestId: 'space', authenticatedAt: new Date() }
    const actor = kind === 'teacher'
      ? createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' })
      : kind === 'guardian'
        ? createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' })
        : kind === 'student'
          ? createStudentActorMetadata({ ...identity, studentId: 'student-a' })
          : createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })
    service = new SchoolService({ actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    await fixture.repositories.periodDefinitions.save(new PeriodDefinition({ id: 'monday', schoolId: 'school-a', academicYearId: 'year-a', label: 'Monday', dayOfWeek: DayOfWeek.Monday, order: 1, startTime: '08:00', endTime: '09:00' }))
    for (const [id, scopeKind, scopeId, date] of [
      ['other-class', CalendarEventScopeKind.ClassGroup, 'class-other', '2026-05-04'],
      ['school-day', CalendarEventScopeKind.School, undefined, '2026-05-11'],
      ['grade-day', CalendarEventScopeKind.GradeLevel, 'level-a', '2026-05-18'],
      ['class-day', CalendarEventScopeKind.ClassGroup, 'class-a', '2026-05-25'],
    ] as const) {
      await fixture.repositories.calendarEvents.save(new CalendarEvent({ id, schoolId: 'school-a', academicYearId: 'year-a', title: id, scopeKind, scopeId, startDate: new Date(date), endDate: new Date(date), kind: CalendarEventKind.Holiday, isNonSchoolDay: true }))
    }
    const input = { classGroupId: 'class-a', academicYearId: 'year-a', startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31') }
    const scoped = await service.baseService.access.timetable.spaceRepositories(input)
    expect((await scoped.calendarEvents.list()).map(event => event.id).sort()).toEqual(['class-day', 'grade-day', 'school-day'])
    expect(await scoped.calendarEvents.count()).toBe(3)
    expect(await scoped.calendarEvents.findById('other-class')).toBeUndefined()
    expect((await service.resolveTimetableSpace(input)).map(cell => cell.date)).toEqual(['2026-05-04'])
    for (const classGroupId of ['missing', 'class-other', 'class-b'])
      await expect(service.resolveTimetableSpace({ ...input, classGroupId })).rejects.toBeInstanceOf(AuthorizationError)
    for (const academicYearId of ['year-old', 'year-b'])
      await expect(service.resolveTimetableSpace({ ...input, academicYearId })).rejects.toBeInstanceOf(AuthorizationError)
    const revoke = {
      staff: 'DELETE FROM staff_permission_assignments WHERE id = \'space\'',
      teacher: 'DELETE FROM teacher_assignments WHERE teacher_id = \'teacher-a\'',
      guardian: 'DELETE FROM guardian_student_links WHERE guardian_id = \'guardian-a\'',
      student: 'UPDATE students SET status = \'inactive\' WHERE id = \'student-a\'',
    }[kind]
    await fixture.db.exec(revoke)
    await expect(service.resolveTimetableSpace(input)).rejects.toBeInstanceOf(AuthorizationError)
  })
})
