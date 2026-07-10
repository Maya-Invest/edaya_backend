import type { FileStoragePort } from '@edaya/core'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
} from '@edaya/authorization'
import { AcademicPeriodType, ActivityCategory, Attachment, AttachmentOwnerKind, AttachmentStatus, AttendanceMode, BusinessRuleViolationError, ClassGroup, DayOfWeek, Resource, ResourceKind, School, StaffMember } from '@edaya/core'
import {
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import { createPlatformRegisterTestActor } from '../../support/elevated-test-actor'
import { testFileStorage } from '../../support/test-file-storage'
import {
  createFullSetupContext,
  createSetupContext,
} from './workflow-test-context'

describe('SchoolService setup workflows', () => {
  test('createAcademicYear creates an active year and deactivates existing active years through managed service', async () => {
    const { academicYears, mockAtomic, mockRepos, service } = createSetupContext()

    const result = await service.setupWorkflow.createAcademicYear({
      id: 'ay-new',
      schoolId: 'sch1',
      name: '2027-2028',
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2028-06-30T00:00:00Z'),
      createdAt: new Date('2027-01-01T00:00:00Z'),
    })

    expect(result.id).toBe('ay-new')
    expect(result.isActive).toBe(true)
    expect(academicYears.get('ay-current')?.isActive).toBe(false)
    expect(academicYears.get('ay-new')?.isActive).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ay-current',
      isActive: false,
    }))
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(result)
  })

  test('activateAcademicYear activates an existing year and deactivates other active years through managed service', async () => {
    const { academicYears, mockAtomic, mockRepos, service } = createSetupContext()

    const result = await service.setupWorkflow.activateAcademicYear({
      academicYearId: 'ay-next',
    })

    expect(result.id).toBe('ay-next')
    expect(result.isActive).toBe(true)
    expect(academicYears.get('ay-current')?.isActive).toBe(false)
    expect(academicYears.get('ay-next')?.isActive).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ay-current',
      isActive: false,
    }))
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(result)
  })

  test('activateAcademicYear rejects unknown academic years', async () => {
    const { service } = createSetupContext()

    await expect(service.setupWorkflow.activateAcademicYear({
      academicYearId: 'missing-year',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('registerSchool seeds notification templates for a new school', async () => {
    const { mockRepos, schools, service } = createFullSetupContext({
      actorOverride: createPlatformRegisterTestActor('sch-new'),
    })

    const school = await service.setupWorkflow.registerSchool({
      id: 'sch-new',
      name: 'New School',
      timeZone: 'UTC',
    })

    expect(school.id).toBe('sch-new')
    expect(schools.store.get('sch-new')?.name).toBe('New School')
    expect(mockRepos.schoolNotificationTemplates.save).toHaveBeenCalled()
  })

  test('updateSchoolConfiguration updates school fields for elevated staff', async () => {
    const { schools, service } = createFullSetupContext()
    schools.store.set('sch1', new School({
      id: 'sch1',
      name: 'School',
      timeZone: 'UTC',
      ownerSubjectId: 'owner-subject',
      enforceScheduleConflicts: true,
      timetableEnforceWorkloadFulfillment: false,
      timetableExcludeBreakSlots: false,
      timetableMinPeriodGapSameSubject: 4,
      timetablePreferredPeriodDefinitionIds: ['period-1'],
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
    expect(updated.timetableMinPeriodGapSameSubject).toBe(4)
    expect(updated.timetablePreferredPeriodDefinitionIds).toEqual(['period-1'])
    expect(schools.store.get('sch1')?.name).toBe('Renamed School')
  })

  test('updateSchoolConfiguration rejects owner transfer from non-owner staff', async () => {
    const limitedActor = createStaffActorMetadata({
      subjectId: 'other-subject',
      staffMemberId: 'staff-other',
      schoolId: 'sch1',
      requestId: 'request',
      authenticatedAt: new Date('2026-01-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set(),
        scopeGrants: [],
        isElevated: false,
      },
    })
    const { service } = createFullSetupContext({ actorOverride: limitedActor })

    await expect(service.setupWorkflow.updateSchoolConfiguration({
      schoolId: 'sch1',
      ownerSubjectId: 'new-owner-subject',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('createAcademicPeriod and publishAcademicPeriod persist period state', async () => {
    const { academicPeriods, service } = createFullSetupContext()

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
    expect(academicPeriods.store.get('period-1')).toBeDefined()

    const published = await service.setupWorkflow.publishAcademicPeriod({
      academicPeriodId: 'period-1',
    })

    expect(published.isPublished).toBe(true)
    expect(academicPeriods.store.get('period-1')?.isPublished).toBe(true)
  })

  test('createClassGroup persists the class and syncs grade-level subjects', async () => {
    const { classGroups, mockAtomic, mockRepos, service } = createFullSetupContext()

    const classGroup = await service.setupWorkflow.createClassGroup({
      id: 'cg-new',
      schoolId: 'sch1',
      academicYearId: 'ay-current',
      gradeLevelId: 'grade-1',
      name: 'Grade 7A',
      attendanceMode: AttendanceMode.Session,
    })

    expect(classGroup.id).toBe('cg-new')
    expect(classGroups.store.get('cg-new')).toBeDefined()
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockRepos.classSubjects.save).not.toHaveBeenCalled()
  })

  test('updateClassGroupConfiguration updates an existing class group', async () => {
    const { classGroups, service } = createFullSetupContext()
    classGroups.store.set('cg-existing', new ClassGroup({
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
    expect(classGroups.store.get('cg-existing')?.name).toBe('Grade 7B Honors')
  })

  test('registerStaffMember and updateStaffMemberStatus persist staff lifecycle', async () => {
    const { staffMembers, service } = createFullSetupContext()

    const created = await service.setupWorkflow.registerStaffMember({
      id: 'staff-new',
      schoolId: 'sch1',
      firstName: 'Jane',
      lastName: 'Doe',
      sendAccountInvitation: false,
    })

    expect(created.isActive).toBe(true)
    expect(staffMembers.store.get('staff-new')).toBeDefined()

    staffMembers.store.set('staff-new', new StaffMember({
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
    expect(staffMembers.store.get('staff-new')?.isActive).toBe(false)
  })

  test('updateStaffMemberProfile updates profile fields', async () => {
    const { staffMembers, service } = createFullSetupContext()
    staffMembers.store.set('staff-profile', new StaffMember({
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
    })

    expect(updated.firstName).toBe('Janet')
    expect(updated.email).toBe('janet@school.test')
  })

  test('configureGradeLevel, period definition, resource, and activity persist configuration entities', async () => {
    const { activities, gradeLevels, periodDefinitions, resources, service } = createFullSetupContext()

    const gradeLevel = await service.setupWorkflow.configureGradeLevel({
      id: 'grade-1',
      schoolId: 'sch1',
      name: 'Grade 7',
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

    expect(gradeLevels.store.get(gradeLevel.id)).toBeDefined()
    expect(periodDefinitions.store.get(periodDefinition.id)).toBeDefined()
    expect(resources.store.get(resource.id)).toBeDefined()
    expect(activities.store.get(activity.id)).toBeDefined()
  })

  test('assignResourceToClass and removeResourceAssignment manage resource assignments', async () => {
    const { classGroups, resourceAssignments, resources, service } = createFullSetupContext()
    classGroups.store.set('cg-new', new ClassGroup({
      id: 'cg-new',
      schoolId: 'sch1',
      academicYearId: 'ay-current',
      gradeLevelId: 'grade-1',
      name: 'Grade 7A',
      attendanceMode: AttendanceMode.Session,
    }))
    resources.store.set('res-1', new Resource({
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

    expect(resourceAssignments.store.get('ra-1')).toBeDefined()
    await service.setupWorkflow.removeResourceAssignment({ resourceAssignmentId: assignment.id })
    expect(resourceAssignments.store.has('ra-1')).toBe(false)
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
    const { attachments, service } = createFullSetupContext({ fileStorage })

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
    expect(attachments.store.get('att-1')).toBeDefined()
    expect(headObject).toHaveBeenCalledWith('uploads/report.pdf')
  })

  test('registerAttachment rejects missing storage objects and metadata mismatches', async () => {
    const { service: missingObjectService } = createFullSetupContext()
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
    const { service: mismatchService } = createFullSetupContext({ fileStorage: mismatchedStorage })
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
    const { attachments, service } = createFullSetupContext({ fileStorage })
    attachments.store.set('att-remove', new Attachment({
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
    expect(attachments.store.has('att-remove')).toBe(false)
  })
})
