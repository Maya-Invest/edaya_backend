import type { ActorMetadata } from '@edaya/authorization'
import type { FileStoragePort } from '@edaya/core'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
} from '@edaya/authorization'
import { AcademicPeriodType, AcademicYear, ActivityCategory, Attachment, AttachmentOwnerKind, AttachmentStatus, AttendanceMode, BusinessRuleViolationError, ClassGroup, DayOfWeek, GradeLevel, Resource, ResourceKind, School, StaffMember, Student } from '@edaya/core'
import {
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createPlatformRegisterTestActor, createTestStaffActor } from '../../support/test-actor'
import { testFileStorage } from '../../support/test-file-storage'

async function createContext({ fileStorage = testFileStorage, actorOverride }: { fileStorage?: FileStoragePort, actorOverride?: ActorMetadata } = {}) {
  const owner = createTestStaffActor('sch1', 'user1')
  const fixture = await createTestApp(owner, { owner: true, fileStorage })
  const repositories = fixture.schoolRepositories
  if (actorOverride?.kind === 'staff')
    await repositories.staffMembers.save(new StaffMember({ id: actorOverride.staffMemberId, schoolId: actorOverride.schoolId, firstName: 'Other', lastName: 'Staff', subjectId: actorOverride.subjectId }))
  await repositories.academicYears.save(new AcademicYear({ id: 'ay-current', schoolId: 'sch1', name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), status: 'published' }))
  await repositories.academicYears.save(new AcademicYear({ id: 'ay-next', schoolId: 'sch1', name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30'), status: 'draft' }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'grade-1', schoolId: 'sch1', name: 'Grade 7', label: 'G7', order: 7 }))
  await repositories.students.save(new Student({ id: 'stu1', schoolId: 'sch1', firstName: 'Student', lastName: 'One', birthDate: new Date('2010-01-01') }))
  return { ...repositories, service: actorOverride ? fixture.forActor(actorOverride) : fixture.app }
}

describe('SchoolService setup workflows', () => {
  test('createAcademicYear creates a draft year without changing existing years', async () => {
    const { academicYears, service } = await createContext()

    const result = await service.setupWorkflow.createAcademicYear({
      id: 'ay-new',
      schoolId: 'sch1',
      name: '2027-2028',
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2028-06-30T00:00:00Z'),
      createdAt: new Date('2027-01-01T00:00:00Z'),
    })

    expect(result.id).toBe('ay-new')
    expect(result.status).toBe('draft')
    expect((await academicYears.findById('ay-current'))?.status).toBe('published')
    expect((await academicYears.findById('ay-new'))?.status).toBe('draft')
    expect((await academicYears.findById(result.id))?.data).toEqual(result.data)
  })

  test('publishAcademicYear publishes a draft year when no other year is published', async () => {
    const { academicYears, service } = await createContext()
    await academicYears.save(new AcademicYear({
      id: 'ay-current',
      schoolId: 'sch1',
      name: '2025-2026',
      startDate: new Date('2025-09-01T00:00:00Z'),
      endDate: new Date('2026-06-30T00:00:00Z'),
      status: 'archived',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    }))

    const result = await service.setupWorkflow.publishAcademicYear({
      academicYearId: 'ay-next',
    })

    expect(result.id).toBe('ay-next')
    expect(result.status).toBe('published')
    expect((await academicYears.findById('ay-next'))?.status).toBe('published')
    expect((await academicYears.findById(result.id))?.data).toEqual(result.data)
  })

  test('publishAcademicYear rejects when another year is already published', async () => {
    const { service } = await createContext()

    await expect(service.setupWorkflow.publishAcademicYear({
      academicYearId: 'ay-next',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('publishAcademicYear rejects when year is not draft', async () => {
    const { service } = await createContext()

    await expect(service.setupWorkflow.publishAcademicYear({
      academicYearId: 'ay-current',
    })).rejects.toMatchObject({
      code: 'ACADEMIC_YEAR_NOT_DRAFT',
    })
  })

  test('archiveAcademicYear archives a published year', async () => {
    const { academicYears, service } = await createContext()

    const result = await service.setupWorkflow.archiveAcademicYear({
      academicYearId: 'ay-current',
    })

    expect(result.id).toBe('ay-current')
    expect(result.status).toBe('archived')
    expect((await academicYears.findById('ay-current'))?.status).toBe('archived')
    expect((await academicYears.findById(result.id))?.data).toEqual(result.data)
  })

  test('archiveAcademicYear rejects when year is not published', async () => {
    const { service } = await createContext()

    await expect(service.setupWorkflow.archiveAcademicYear({
      academicYearId: 'ay-next',
    })).rejects.toMatchObject({
      code: 'ACADEMIC_YEAR_NOT_PUBLISHED',
    })
  })

  test('publishAcademicYear rejects unknown academic years', async () => {
    const { service } = await createContext()

    await expect(service.setupWorkflow.publishAcademicYear({
      academicYearId: 'missing-year',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('registerSchool seeds notification templates for a new school', async () => {
    const { schoolNotificationTemplates, schools, service } = await createContext({
      actorOverride: createPlatformRegisterTestActor('sch-new'),
    })

    const school = await service.setupWorkflow.registerSchool({
      id: 'sch-new',
      name: 'New School',
      timeZone: 'UTC',
    })

    expect(school.id).toBe('sch-new')
    expect((await schools.findById('sch-new'))?.name).toBe('New School')
    expect(await schoolNotificationTemplates.findById('sch-new')).toBeDefined()
  })

  test('updateSchoolConfiguration updates school fields for elevated staff', async () => {
    const { schools, service } = await createContext()
    await schools.save(new School({
      id: 'sch1',
      name: 'School',
      timeZone: 'UTC',
      ownerSubjectId: 'subject-test',
      enforceScheduleConflicts: true,
      timetableEnforceWorkloadFulfillment: false,
      timetableExcludeBreakSlots: false,
      timetableMinDayGapSameSubject: 4,
      timetablePreferredPeriodDefinitionIds: ['period-1'],
      timetableAllowUnassignedTeacherPlacements: true,
      timetableUseHomeroomTeacherFallback: true,
      createdAt: new Date('2025-01-01T00:00:00Z'),
    }))

    const updated = await service.setupWorkflow.updateSchoolConfiguration({
      schoolId: 'sch1',
      name: 'Renamed School',
      city: 'Abidjan',
    })

    expect(updated.name).toBe('Renamed School')
    expect(updated.city).toBe('Abidjan')
    expect(updated.enforceScheduleConflicts).toBe(true)
    expect(updated.timetableEnforceWorkloadFulfillment).toBe(false)
    expect(updated.timetableExcludeBreakSlots).toBe(false)
    expect(updated.timetableMinDayGapSameSubject).toBe(4)
    expect(updated.timetablePreferredPeriodDefinitionIds).toEqual(['period-1'])
    expect(updated.timetableAllowUnassignedTeacherPlacements).toBe(true)
    expect(updated.timetableUseHomeroomTeacherFallback).toBe(true)
    expect((await schools.findById('sch1'))?.name).toBe('Renamed School')
  })

  test('updateSchoolConfiguration rejects owner transfer from non-owner staff', async () => {
    const limitedActor = createStaffActorMetadata({
      subjectId: 'other-subject',
      staffMemberId: 'staff-other',
      schoolId: 'sch1',
      requestId: 'request',
      authenticatedAt: new Date('2026-01-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    })
    const { service } = await createContext({ actorOverride: limitedActor })

    await expect(service.setupWorkflow.updateSchoolConfiguration({
      schoolId: 'sch1',
      ownerSubjectId: 'new-owner-subject',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('createAcademicPeriod and publishAcademicPeriod persist period state', async () => {
    const { academicPeriods, service } = await createContext()

    const created = await service.setupWorkflow.createAcademicPeriod({
      id: 'period-1',
      schoolId: 'sch1',
      academicYearId: 'ay-current',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2025-09-01T00:00:00Z'),
      endDate: new Date('2025-12-15T00:00:00Z'),
    })

    expect(created.isPublished).toBe(false)
    expect((await academicPeriods.findById('period-1'))).toBeDefined()

    const published = await service.setupWorkflow.publishAcademicPeriod({
      academicPeriodId: 'period-1',
    })

    expect(published.isPublished).toBe(true)
    expect((await academicPeriods.findById('period-1'))?.isPublished).toBe(true)
  })

  test('createClassGroup persists the class and syncs grade-level subjects', async () => {
    const { classGroups, classSubjects, service } = await createContext()

    const classGroup = await service.setupWorkflow.createClassGroup({
      id: 'cg-new',
      schoolId: 'sch1',
      academicYearId: 'ay-current',
      gradeLevelId: 'grade-1',
      name: 'Grade 7A',
      attendanceMode: AttendanceMode.Session,
    })

    expect(classGroup.id).toBe('cg-new')
    expect((await classGroups.findById('cg-new'))).toBeDefined()
    expect(await classSubjects.count()).toBe(0)
  })

  test('updateClassGroupConfiguration updates an existing class group', async () => {
    const { classGroups, service } = await createContext()
    await classGroups.save(new ClassGroup({
      id: 'cg-existing',
      schoolId: 'sch1',
      academicYearId: 'ay-current',
      gradeLevelId: 'grade-1',
      name: 'Grade 7B',
      attendanceMode: AttendanceMode.Session,
    }))

    const updated = await service.setupWorkflow.updateClassGroupConfiguration({
      classGroupId: 'cg-existing',
      name: 'Grade 7B Honors',
    })

    expect(updated.name).toBe('Grade 7B Honors')
    expect((await classGroups.findById('cg-existing'))?.name).toBe('Grade 7B Honors')
  })

  test('registerStaffMember and updateStaffMemberStatus persist staff lifecycle', async () => {
    const { staffMembers, service } = await createContext()

    const created = await service.setupWorkflow.registerStaffMember({
      id: 'staff-new',
      schoolId: 'sch1',
      firstName: 'Jane',
      lastName: 'Doe',
      sendAccountInvitation: false,
    })

    expect(created.isActive).toBe(true)
    expect((await staffMembers.findById('staff-new'))).toBeDefined()

    await staffMembers.save(new StaffMember({
      id: 'staff-new',
      schoolId: 'sch1',
      firstName: 'Jane',
      lastName: 'Doe',
      subjectId: 'subject-staff-new',
      isActive: true,
      createdAt: created.createdAt,
    }))

    const deactivated = await service.setupWorkflow.updateStaffMemberStatus({
      staffId: 'staff-new',
      isActive: false,
    })

    expect(deactivated.isActive).toBe(false)
    expect((await staffMembers.findById('staff-new'))?.isActive).toBe(false)
  })

  test('updateStaffMemberProfile updates profile fields', async () => {
    const { staffMembers, service } = await createContext()
    await staffMembers.save(new StaffMember({
      id: 'staff-profile',
      schoolId: 'sch1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@school.test',
      subjectId: 'subject-staff-profile',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    const updated = await service.setupWorkflow.updateStaffMemberProfile({
      staffId: 'staff-profile',
      firstName: 'Janet',
      email: 'janet@school.test',
      profileRole: 'secretary',
    })

    expect(updated.firstName).toBe('Janet')
    expect(updated.email).toBe('janet@school.test')
    expect(updated.profileRole).toBe('secretary')

    const deactivated = await service.setupWorkflow.updateStaffMemberStatus({
      staffId: 'staff-profile',
      isActive: false,
    })
    expect(deactivated.isActive).toBe(false)
    expect(deactivated.profileRole).toBe('secretary')
  })

  test('configureGradeLevel, period definition, resource, and activity persist configuration entities', async () => {
    const { activities, gradeLevels, periodDefinitions, resources, service } = await createContext()

    const gradeLevel = await service.setupWorkflow.configureGradeLevel({
      id: 'grade-1',
      schoolId: 'sch1',
      name: 'Grade 7',
      label: 'G7',
      order: 7,
    })
    const periodDefinition = await service.setupWorkflow.configurePeriodDefinition({
      id: 'pd-1',
      schoolId: 'sch1',
      academicYearId: 'ay-current',
      label: 'Morning',
      dayOfWeek: DayOfWeek.Monday,
      order: 1,
      startTime: '08:00',
      endTime: '12:00',
    })
    const resource = await service.setupWorkflow.configureResource({
      id: 'res-1',
      schoolId: 'sch1',
      name: 'Room 101',
      kind: ResourceKind.Location,
    })
    const activity = await service.setupWorkflow.configureActivity({
      id: 'act-1',
      schoolId: 'sch1',
      name: 'Chess club',
      category: ActivityCategory.Arts,
      coach: 'Coach Sam',
      schedule: 'Wednesdays',
      participants: 0,
      capacity: 20,
      description: 'Chess club',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
    })

    expect((await gradeLevels.findById(gradeLevel.id))).toBeDefined()
    expect((await periodDefinitions.findById(periodDefinition.id))).toBeDefined()
    expect((await resources.findById(resource.id))).toBeDefined()
    expect((await activities.findById(activity.id))).toBeDefined()
  })

  test('assignResourceToClass and removeResourceAssignment manage resource assignments', async () => {
    const { classGroups, resourceAssignments, resources, service } = await createContext()
    await classGroups.save(new ClassGroup({
      id: 'cg-new',
      schoolId: 'sch1',
      academicYearId: 'ay-current',
      gradeLevelId: 'grade-1',
      name: 'Grade 7A',
      attendanceMode: AttendanceMode.Session,
    }))
    await resources.save(new Resource({
      id: 'res-1',
      schoolId: 'sch1',
      name: 'Room 101',
      kind: ResourceKind.Location,
    }))

    const assignment = await service.setupWorkflow.assignResourceToClass({
      id: 'ra-1',
      resourceId: 'res-1',
      classGroupId: 'cg-new',
    })

    expect((await resourceAssignments.findById('ra-1'))).toBeDefined()
    await service.setupWorkflow.removeResourceAssignment({ resourceAssignmentId: assignment.id })
    expect(Boolean(await resourceAssignments.findById('ra-1'))).toBe(false)
  })

  test('registerAttachment validates storage metadata before saving', async () => {
    const headObject = mock(async () => ({
      sizeBytes: 1024,
      contentType: 'application/pdf',
    }))
    const fileStorage: FileStoragePort = {
      ...testFileStorage,
      headObject,
      deleteObject: mock(async () => {}),
    }
    const { attachments, service } = await createContext({ fileStorage })

    const attachment = await service.setupWorkflow.registerAttachment({
      id: 'att-1',
      schoolId: 'sch1',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      fileName: 'report.pdf',
      storageKey: 'uploads/report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      status: AttachmentStatus.PendingUpload,
    })

    expect(attachment.status).toBe(AttachmentStatus.Ready)
    expect((await attachments.findById('att-1'))).toBeDefined()
    expect(headObject).toHaveBeenCalledWith('uploads/report.pdf')
  })

  test('registerAttachment rejects missing storage objects and metadata mismatches', async () => {
    const { service: missingObjectService } = await createContext()
    await expect(missingObjectService.setupWorkflow.registerAttachment({
      id: 'att-missing',
      schoolId: 'sch1',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      fileName: 'report.pdf',
      storageKey: 'uploads/missing.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    const mismatchedStorage: FileStoragePort = {
      ...testFileStorage,
      headObject: mock(async () => ({ sizeBytes: 512, contentType: 'application/pdf' })),
    }
    const { service: mismatchService } = await createContext({ fileStorage: mismatchedStorage })
    await expect(mismatchService.setupWorkflow.registerAttachment({
      id: 'att-size',
      schoolId: 'sch1',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      fileName: 'report.pdf',
      storageKey: 'uploads/report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('removeAttachment deletes storage objects when present', async () => {
    const deleteObject = mock(async () => {})
    const fileStorage: FileStoragePort = {
      ...testFileStorage,
      deleteObject,
    }
    const { attachments, service } = await createContext({ fileStorage })
    await attachments.save(new Attachment({
      id: 'att-remove',
      schoolId: 'sch1',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      fileName: 'report.pdf',
      storageKey: 'uploads/report.pdf',
      status: AttachmentStatus.Ready,
    }))

    await service.setupWorkflow.removeAttachment({ attachmentId: 'att-remove' })

    expect(deleteObject).toHaveBeenCalledWith('uploads/report.pdf')
    expect(Boolean(await attachments.findById('att-remove'))).toBe(false)
  })
})
