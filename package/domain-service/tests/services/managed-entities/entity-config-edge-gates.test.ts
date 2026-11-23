import type { SchoolRepositories } from '@edaya/service'
import { AuthorizationError } from '@edaya/authorization'
import { AttachmentOwnerKind, BusinessRuleViolationError, CalendarEvent, CalendarEventKind, CalendarEventScopeKind, DayOfWeek, LessonSession, Schedule } from '@edaya/core'
import { validateAttachmentSave, validateCalendarEventSave, validateLessonSessionSave, validateScheduleSave, validateStaffAssignmentSave } from '@edaya/service'
import { describe, expect, mock, test } from 'bun:test'

function repositories(overrides: Partial<SchoolRepositories> = {}): SchoolRepositories {
  return {
    academicYears: { findById: mock(async () => ({ id: 'year-1', schoolId: 'school', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })) },
    assessmentResults: { findById: mock(async () => ({ id: 'result-1', studentId: 'student-1' })) },
    attendance: { findById: mock(async () => ({ id: 'attendance-1', studentId: 'student-1', lessonSessionId: 'session-1' })) },
    classGroups: { findById: mock(async () => ({ id: 'class-1', schoolId: 'school', academicYearId: 'year-1' })) },
    classSubjects: { findById: mock(async () => ({ id: 'subject-1', classGroupId: 'class-1' })) },
    enrollments: {
      count: mock(async () => 2),
      findById: mock(async () => ({ id: 'enrollment-1', studentId: 'student-1', classGroupId: 'class-1' })),
      list: mock(async () => []),
    },
    gradeLevels: {
      findById: mock(async () => ({ id: 'grade-1', schoolId: 'school' })),
    },
    guardians: { findById: mock(async () => ({ id: 'guardian-1', schoolId: 'school' })) },
    incidents: { findById: mock(async () => ({ id: 'incident-1', schoolId: 'school' })) },
    payments: { findById: mock(async () => ({ id: 'payment-1', accountId: 'account-1' })) },
    results: { findById: mock(async () => ({ id: 'report-card-1', studentId: 'student-1' })) },
    lessonSessions: { findById: mock(async () => ({ id: 'session-1', classGroupId: 'class-1', classSubjectId: 'subject-1', schoolId: 'school' })) },
    staffMembers: { findById: mock(async () => ({ id: 'staff-1', schoolId: 'school' })) },
    teachers: { findById: mock(async () => ({ id: 'teacher-1', schoolId: 'school' })) },
    studentDisciplinaryActions: { findById: mock(async () => ({ id: 'action-1', studentId: 'student-1' })) },
    studentYearAccounts: { findById: mock(async () => ({ id: 'account-1', studentId: 'student-1', schoolId: 'school' })) },
    studentCharges: { findById: mock(async () => ({ id: 'student-fee-1', studentId: 'student-1' })) },
    studentHealthProfiles: {
      findById: mock(async () => ({ id: 'health-1', schoolId: 'school', studentId: 'student-1' })),
      list: mock(async () => []),
    },
    students: {
      findById: mock(async () => ({ id: 'student-1', schoolId: 'school' })),
      list: mock(async () => []),
    },
    ...overrides,
  } as unknown as SchoolRepositories
}

function attachment(ownerKind: AttachmentOwnerKind, ownerId = `${ownerKind}-1`, schoolId = 'school'): any {
  return {
    id: `attachment-${ownerKind}`,
    schoolId,
    ownerKind,
    ownerId,
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    storageKey: 'attachments/document.pdf',
    uploadedByStaffId: 'staff-1',
  }
}

describe('entity config edge gates', () => {
  test('resolves every supported attachment owner kind before save', async () => {
    const repos = repositories()

    await validateAttachmentSave(attachment(AttachmentOwnerKind.Student, 'student-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.Guardian, 'guardian-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.Staff, 'staff-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.Teacher, 'teacher-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.StudentHealthProfile, 'health-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.StudentClassEnrollment, 'enrollment-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.AttendanceRecord, 'attendance-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.Incident, 'incident-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.StudentDisciplinaryAction, 'action-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.AssessmentResult, 'result-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.ReportCard, 'report-card-1'), undefined, repos)
    await validateAttachmentSave(attachment(AttachmentOwnerKind.Payment, 'payment-1'), undefined, repos)
  })

  test('rejects unsupported or mismatched attachment owners', async () => {
    await expect(validateAttachmentSave(attachment(AttachmentOwnerKind.Other, 'owner-1'), undefined, repositories()))
      .rejects
      .toBeInstanceOf(BusinessRuleViolationError)
    await expect(validateAttachmentSave(attachment(AttachmentOwnerKind.Student, 'student-1', 'other-school'), undefined, repositories()))
      .rejects
      .toBeInstanceOf(AuthorizationError)
    await expect(validateAttachmentSave(attachment(AttachmentOwnerKind.Payment, 'payment-1'), undefined, repositories({
      studentYearAccounts: { findById: mock(async () => undefined) } as any,
    })))
      .rejects
      .toBeInstanceOf(AuthorizationError)
  })

  test('validates schedule and lesson session class-subject ownership', async () => {
    const repos = repositories()

    await validateScheduleSave(new Schedule({
      id: 'schedule-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      classSubjectId: 'subject-1',
      title: 'Math',
      dayOfWeek: DayOfWeek.Monday,
      startTime: '09:00',
      endTime: '10:00',
      isRecurring: true,
    } as any), undefined, repos)
    await validateLessonSessionSave(new LessonSession({
      id: 'session-new',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'schedule-1',
      classSubjectId: 'subject-1',
      displayLabel: 'Math',
      startsAt: new Date('2026-03-01T09:00:00Z'),
      endsAt: new Date('2026-03-01T10:00:00Z'),
    }), undefined, repos)

    await expect(validateScheduleSave(new Schedule({
      id: 'schedule-2',
      schoolId: 'school',
      classGroupId: 'class-2',
      classSubjectId: 'subject-1',
      title: 'Math',
      dayOfWeek: DayOfWeek.Monday,
      startTime: '09:00',
      endTime: '10:00',
      isRecurring: true,
    } as any), undefined, repos)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('validates calendar event year containment and scoped owner schools', async () => {
    await validateCalendarEventSave(new CalendarEvent({
      id: 'event-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      title: 'Class day',
      kind: CalendarEventKind.Event,
      scopeKind: CalendarEventScopeKind.ClassGroup,
      scopeId: 'class-1',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-01'),
    }), undefined, repositories())

    await expect(validateCalendarEventSave(new CalendarEvent({
      id: 'event-2',
      schoolId: 'school',
      academicYearId: 'year-1',
      title: 'Outside year',
      kind: CalendarEventKind.Holiday,
      scopeKind: CalendarEventScopeKind.School,
      startDate: new Date('2027-01-01'),
      endDate: new Date('2027-01-02'),
    }), undefined, repositories())).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(validateCalendarEventSave(new CalendarEvent({
      id: 'event-3',
      schoolId: 'school',
      academicYearId: 'year-1',
      title: 'Wrong grade',
      kind: CalendarEventKind.Holiday,
      scopeKind: CalendarEventScopeKind.GradeLevel,
      scopeId: 'grade-1',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-01'),
    }), undefined, repositories({
      gradeLevels: { findById: mock(async () => ({ id: 'grade-1', schoolId: 'other-school' })) } as any,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('validates staff assignment targets through class group, class subject, and lesson session paths', async () => {
    await validateStaffAssignmentSave({ id: 'a1', staffId: 'staff-1', academicYearId: 'year-1', classGroupId: 'class-1' } as any, undefined, repositories())
    await validateStaffAssignmentSave({ id: 'a2', staffId: 'staff-1', academicYearId: 'year-1', classSubjectId: 'subject-1' } as any, undefined, repositories())
    await validateStaffAssignmentSave({ id: 'a3', staffId: 'staff-1', academicYearId: 'year-1', lessonSessionId: 'session-1' } as any, undefined, repositories())

    await expect(validateStaffAssignmentSave({ id: 'a4', staffId: 'missing', academicYearId: 'year-1', classGroupId: 'class-1' } as any, undefined, repositories({
      staffMembers: { findById: mock(async () => undefined) } as any,
    }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(validateStaffAssignmentSave({ id: 'a5', staffId: 'staff-1', academicYearId: 'year-1', classSubjectId: 'missing-subject' } as any, undefined, repositories({
      classSubjects: { findById: mock(async () => undefined) } as any,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })
})
