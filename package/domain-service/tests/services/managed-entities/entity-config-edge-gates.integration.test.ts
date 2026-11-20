import type { SchoolRepositories } from '@edaya/service'
import { ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, Announcement, AnnouncementTarget, AttachmentOwnerKind, BusinessRuleViolationError, CalendarEvent, CalendarEventKind, CalendarEventScopeKind, ChargeStatus, ClassGroup, DayOfWeek, GradeLevel, LessonSession, Permission, Resource, ResourceAssignment, ResourceKind, Schedule, StaffPermissionAssignment, Student, StudentCharge, StudentClassEnrollment, StudentHealthProfile, StudentNote, StudentNoteVisibility, StudentStatus, AnnouncementTargetKind as TargetKind, withShortName } from '@edaya/core'
import { validateAttachmentSave, validateCalendarEventSave, validateLessonSessionSave, validateScheduleSave, validateStaffAssignmentSave, validateStudentSave } from '@edaya/service'
import { describe, expect, mock, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { actor } from './managed-entity-test-context'

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

  test('validates student profile status and student delete dependencies', async () => {
    const graduated = new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'A',
      lastName: 'Student',
      enrollmentDate: new Date('2026-01-01'),
      status: StudentStatus.Graduated,
    })
    await expect(validateStudentSave(graduated.copyWith({ status: StudentStatus.Active }), graduated))
      .rejects
      .toBeInstanceOf(BusinessRuleViolationError)

    const { app, repositories: store } = await createTestApp(actor, { owner: true })
    const year = new AcademicYear(withShortName({
      id: 'year-1',
      schoolId: 'school',
      name: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'published',
    }))
    const student = new Student({
      id: 'student-delete',
      schoolId: 'school',
      firstName: 'Delete',
      lastName: 'Blocked',
      enrollmentDate: new Date('2026-01-01'),
    })
    await store.academicYearRepository.save(year)
    await store.studentRepository.save(student)
    await store.studentChargeRepository.save(new StudentCharge({
      id: 'student-fee-1',
      schoolId: student.schoolId,
      studentId: student.id,
      enrollmentId: 'enr-1',
      label: 'Tuition',
      expectedAmount: 100,
      allocatedAmount: 0,
      academicYearId: year.id,
      currency: 'USD',
      status: ChargeStatus.Pending,
    }))

    await expect(app.baseService.entities.students.delete(student.id)).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('validates student note staff-only authorship and restricted visibility', async () => {
    const student = new Student({
      id: 'student-note',
      schoolId: 'school',
      firstName: 'Note',
      lastName: 'Target',
      enrollmentDate: new Date('2026-01-01'),
    })

    const systemContext = await createTestApp(actor, { owner: true })
    await systemContext.repositories.studentRepository.save(student)
    await systemContext.app.baseService.entities.studentNotes.save(new StudentNote({
      id: 'system-note',
      schoolId: 'school',
      studentId: student.id,
      authorStaffId: 'staff-test',
      body: 'The selected staff profile authors its own note',
    }))

    const teacherActor = createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher',
      schoolId: 'school',
      requestId: 'teacher-note',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    })
    const teacherContext = await createTestApp(teacherActor)
    await teacherContext.repositories.studentRepository.save(student)
    await teacherContext.schoolRepositories.academicYears.save(new AcademicYear(withShortName({ id: 'year-note', schoolId: 'school', name: 'Notes year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' })))
    await teacherContext.schoolRepositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'grade-note', schoolId: 'school', name: 'Grade', shortName: 'G', order: 1 })))
    await teacherContext.schoolRepositories.classGroups.save(new ClassGroup(withShortName({ id: 'teacher-class', schoolId: 'school', academicYearId: 'year-note', gradeLevelId: 'grade-note', name: 'Class' })))
    await teacherContext.schoolRepositories.enrollments.save(new StudentClassEnrollment({ id: 'teacher-enrollment', studentId: student.id, classGroupId: 'teacher-class', academicYearId: 'year-note', enrollmentIndex: 1 }))
    await teacherContext.schoolRepositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'notes', schoolId: 'school', academicYearId: 'year-note', staffId: 'teacher', permission: Permission.STUDENT_NOTE_MANAGE, scopes: [{ kind: 'class_group', classGroupId: 'teacher-class' }] }))

    await expect(teacherContext.app.baseService.entities.studentNotes.save(new StudentNote({
      id: 'admin-only-note',
      schoolId: 'school',
      studentId: student.id,
      authorStaffId: 'teacher',
      body: 'Restricted note',
      visibility: StudentNoteVisibility.AdminOnly,
    }))).rejects.toBeInstanceOf(AuthorizationError)

    const teacherNote = new StudentNote({
      id: 'teacher-note',
      schoolId: 'school',
      studentId: student.id,
      authorStaffId: 'teacher',
      body: 'Visible note',
    })
    await teacherContext.app.baseService.entities.studentNotes.save(teacherNote)

    await expect(teacherContext.app.baseService.entities.studentNotes.save(new StudentNote({
      id: teacherNote.id,
      schoolId: 'school',
      studentId: student.id,
      authorStaffId: 'other-teacher',
      body: 'Spoof author',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('validates student health profile uniqueness and immutable ownership', async () => {
    const { app, repositories: store } = await createTestApp()
    await store.studentRepository.save(new Student({
      id: 'student-health',
      schoolId: 'school',
      firstName: 'Health',
      lastName: 'Target',
      enrollmentDate: new Date('2026-01-01'),
    }))
    await store.studentRepository.save(new Student({
      id: 'student-health-other',
      schoolId: 'school',
      firstName: 'Other',
      lastName: 'Target',
      enrollmentDate: new Date('2026-01-01'),
    }))

    const profile = new StudentHealthProfile({
      id: 'health-profile',
      schoolId: 'school',
      studentId: 'student-health',
      allergies: 'Peanuts',
    })
    await app.baseService.entities.studentHealthProfiles.save(profile)

    await expect(app.baseService.entities.studentHealthProfiles.save(new StudentHealthProfile({
      id: 'health-profile-duplicate',
      schoolId: 'school',
      studentId: 'student-health',
      medicalConditions: 'Asthma',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(app.baseService.entities.studentHealthProfiles.save(new StudentHealthProfile({
      id: profile.id,
      schoolId: 'school',
      studentId: 'student-health-other',
      allergies: 'Peanuts',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('requires verified assurance for student health profile writes', async () => {
    const standardCoordinator = await createTestApp(createStaffActorMetadata({
      subjectId: 'coordinator-user',
      staffMemberId: 'coordinator-standard',
      schoolId: 'school',
      requestId: 'health-standard',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Standard,
    }))
    await standardCoordinator.schoolRepositories.academicYears.save(new AcademicYear(withShortName({ id: 'health-year', schoolId: 'school', name: 'Health year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' })))
    await standardCoordinator.schoolRepositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'health-update', schoolId: 'school', academicYearId: 'health-year', staffId: 'coordinator-standard', permission: Permission.STUDENT_HEALTH_UPDATE, scopes: [{ kind: 'all', grain: 'student' }] }))
    await standardCoordinator.repositories.studentRepository.save(new Student({
      id: 'student-health-standard',
      schoolId: 'school',
      firstName: 'Health',
      lastName: 'Standard',
      enrollmentDate: new Date('2026-01-01'),
    }))

    await expect(standardCoordinator.app.baseService.entities.studentHealthProfiles.save(new StudentHealthProfile({
      id: 'health-standard',
      schoolId: 'school',
      studentId: 'student-health-standard',
      allergies: 'Peanuts',
    }))).rejects.toBeInstanceOf(AuthorizationError)

    const verifiedCoordinator = await createTestApp(createStaffActorMetadata({
      subjectId: 'coordinator-user',
      staffMemberId: 'coordinator-verified',
      schoolId: 'school',
      requestId: 'health-verified',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))
    await verifiedCoordinator.schoolRepositories.academicYears.save(new AcademicYear(withShortName({ id: 'health-year', schoolId: 'school', name: 'Health year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' })))
    await verifiedCoordinator.schoolRepositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'health-update', schoolId: 'school', academicYearId: 'health-year', staffId: 'coordinator-verified', permission: Permission.STUDENT_HEALTH_UPDATE, scopes: [{ kind: 'all', grain: 'student' }] }))
    await verifiedCoordinator.repositories.studentRepository.save(new Student({
      id: 'student-health-verified',
      schoolId: 'school',
      firstName: 'Health',
      lastName: 'Verified',
      enrollmentDate: new Date('2026-01-01'),
    }))

    await expect(verifiedCoordinator.app.baseService.entities.studentHealthProfiles.save(new StudentHealthProfile({
      id: 'health-verified',
      schoolId: 'school',
      studentId: 'student-health-verified',
      allergies: 'Peanuts',
    }))).resolves.toBeUndefined()
  })

  test('blocks deleting announcements and resources with dependent records', async () => {
    const { app, repositories: store } = await createTestApp()

    const announcement = new Announcement({
      id: 'announcement-delete',
      schoolId: 'school',
      title: 'Dependent announcement',
      content: 'Cannot delete with targets',
      createdBy: 'admin',
    })
    await store.announcementRepository.save(announcement)
    await store.announcementTargetRepository.save(new AnnouncementTarget({
      id: 'announcement-target-delete',
      announcementId: announcement.id,
      targetKind: TargetKind.AllStudents,
    }))

    await expect(app.baseService.entities.announcements.delete(announcement.id)).rejects.toBeInstanceOf(BusinessRuleViolationError)

    const resource = new Resource(withShortName({
      id: 'resource-delete',
      schoolId: 'school',
      name: 'Room A',
      kind: ResourceKind.Location,
      capacity: 20,
    }))
    await store.resourceRepository.save(resource)
    await store.resourceAssignmentRepository.save(new ResourceAssignment({
      id: 'resource-assignment-delete',
      resourceId: resource.id,
      classGroupId: 'class-delete',
    }))

    await expect(app.baseService.entities.resources.delete(resource.id)).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})
