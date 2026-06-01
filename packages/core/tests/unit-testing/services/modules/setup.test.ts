import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import type { ActorMetadata } from '../../../../src/services/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { AcademicPeriodType, AttachmentOwnerKind, AttendanceMode, SchoolType, StaffRole } from '../../../../src'
import { SchoolSetupService } from '../../../../src/services/commands/setup'
import { BusinessRuleViolationError } from '../../../../src/services/shared/business-rule-error'

describe('SetupService', () => {
  const mockRepos = {
    academicYears: {
      save: mock(async () => {}),
      findById: mock(async id => ({ id, schoolId: 'sch1', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })),
      findByIds: mock(async (ids: string[]) => ids.map(id => ({ id, schoolId: 'sch1', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }))),
      list: mock(async () => [
        {
          id: 'existing-year',
          schoolId: 'sch1',
          name: 'Existing year',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          isActive: true,
          createdAt: new Date('2025-01-01'),
        },
      ]),
    },
    academicPeriods: {
      save: mock(async () => {}),
      findById: mock(async id => ({
        id,
        schoolId: 'sch1',
        academicYearId: 'ay1',
        name: 'Trimester 1',
        type: AcademicPeriodType.Trimester,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        isPublished: false,
        createdAt: new Date('2026-01-01'),
      })),
      findByIds: mock(async (ids: string[]) => ids.map(id => ({
        id,
        schoolId: 'sch1',
        academicYearId: 'ay1',
        name: 'Trimester 1',
        type: AcademicPeriodType.Trimester,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        isPublished: false,
        createdAt: new Date('2026-01-01'),
      }))),
    },
    schools: {
      save: mock(async () => {}),
      findById: mock(async id => ({
        id,
        name: 'Maya School',
        timeZone: 'America/Toronto',
        type: SchoolType.K12,
        country: 'CA',
        city: 'Montreal',
        createdAt: new Date('2026-01-01'),
      })),
    },
    gradeLevels: {
      findById: mock(async id => ({ id, schoolId: 'sch1' })),
    },
    staffMembers: {
      save: mock(async () => {}),
      findById: mock(async id => id === 'staff-new'
        ? undefined
        : {
            id,
            schoolId: 'sch1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            roles: [StaffRole.Teacher],
            email: 'ada@example.test',
            isActive: true,
            createdAt: new Date('2026-01-01'),
          }),
    },
    classGroups: {
      save: mock(async () => {}),
      findById: mock(async id => ({
        id,
        schoolId: 'sch1',
        academicYearId: 'ay1',
        gradeLevelId: 'grade1',
        name: 'Class 1',
        capacity: 30,
        attendanceMode: AttendanceMode.Session,
        createdAt: new Date('2026-01-01'),
      })),
      findByIds: mock(async (ids: string[]) => ids.map(id => ({
        id,
        schoolId: 'sch1',
        academicYearId: 'ay1',
        gradeLevelId: 'grade1',
        name: 'Class 1',
        capacity: 30,
        attendanceMode: AttendanceMode.Session,
        createdAt: new Date('2026-01-01'),
      }))),
    },
    classSubjects: {
      findById: mock(async id => ({ id, classGroupId: 'cg1', subjectId: 'subj1' })),
    },
    staffAssignments: {
      save: mock(async () => {}),
      findById: mock(async () => undefined),
      findByIds: mock(async () => []),
    },
    students: {
      findById: mock(async id => ({ id, schoolId: 'sch1' })),
    },
    enrollments: {
      findOne: mock(async () => ({ classGroupId: 'cg1' })),
      count: mock(async () => 2),
    },
    resources: {
      save: mock(async () => {}),
      findById: mock(async id => ({ id, schoolId: 'sch1', kind: 'Room' })),
    },
    sessions: {
      findById: mock(async id => ({
        id,
        classGroupId: 'cg1',
        startsAt: new Date('2026-01-01T08:00:00Z'),
        endsAt: new Date('2026-01-01T09:00:00Z'),
      })),
    },
    resourceAssignments: {
      save: mock(async () => {}),
      delete: mock(async () => {}),
      findById: mock(async id => ({ id, resourceId: 'res1', classGroupId: 'cg1' })),
      list: mock(async () => []),
    },
    attachments: {
      save: mock(async () => {}),
      delete: mock(async () => {}),
      findById: mock(async id => ({ id, schoolId: 'sch1', ownerKind: 'student', ownerId: 'stu1' })),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = {
    requirePermission: mock(async () => {}),
    checkStudentAccess: mock(async () => {}),
    checkGuardianAccess: mock(async () => {}),
    checkStudentNoteAccess: mock(async () => {}),
    checkStudentHealthAccess: mock(async () => {}),
    checkClassGroupAccess: mock(async () => {}),
    checkAssessmentAccess: mock(async () => {}),
    checkReportCardResultAccess: mock(async () => {}),
    checkFeeAccess: mock(async () => {}),
    checkStudentFeeAccess: mock(async () => {}),
    checkSessionAccess: mock(async () => {}),
    checkAttendanceAccess: mock(async () => {}),
    checkGlobalAction: mock(async () => {}),
    checkModuleAccess: mock(async () => {}),
  } as unknown as AuthorizationPolicy
  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'sch1',
    requestId: 'req1',
    reason: 'test',
  }

  const service = new SchoolSetupService({ repositories: mockRepos, authorizationPolicy: mockPolicy, actor } as any)

  test('registerSchool saves through managed path after register authorization', async () => {
    const school = await service.registerSchool({
      id: 'sch1',
      name: 'Maya School',
      timeZone: 'America/Toronto',
      type: SchoolType.K12,
      country: 'CA',
      city: 'Montreal',
    })

    expect(school.id).toBe('sch1')
    expect(mockRepos.schools.save).toHaveBeenCalledWith(school)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.register_school')
  })

  test('registerSchool preserves register authorization when delegating', async () => {
    const registerPolicy = {
      ...mockPolicy,
      checkGlobalAction: mock(async (_actor: ActorMetadata, action: string) => {
        if (action === 'setup.manage_lifecycle') {
          throw new Error('setup.manage_lifecycle should not be required after register authorization')
        }
      }),
    } as unknown as AuthorizationPolicy
    const registerService = new SchoolSetupService({ repositories: mockRepos, authorizationPolicy: registerPolicy, actor } as any)

    const school = await registerService.registerSchool({
      id: 'sch1',
      name: 'Maya School',
      timeZone: 'America/Toronto',
    })

    expect(school.id).toBe('sch1')
    expect(registerPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.register_school')
  })

  test('updateSchoolConfiguration saves through managed path after lifecycle authorization', async () => {
    const school = await service.updateSchoolConfiguration({
      schoolId: 'sch1',
      name: 'Updated Maya School',
      timeZone: 'America/New_York',
      type: SchoolType.Secondary,
      country: 'US',
      city: 'New York',
    })

    expect(school.name).toBe('Updated Maya School')
    expect(school.timeZone).toBe('America/New_York')
    expect(mockRepos.schools.save).toHaveBeenCalledWith(school)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage_lifecycle')
  })

  test('createAcademicYear saves inactive year through managed path', async () => {
    const academicYear = await service.createAcademicYear({
      id: 'ay-inactive',
      schoolId: 'sch1',
      name: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: false,
    })

    expect(academicYear.isActive).toBe(false)
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(academicYear)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage')
  })

  test('createAcademicYear deactivates existing active years through managed path', async () => {
    const academicYear = await service.createAcademicYear({
      id: 'ay-active',
      schoolId: 'sch1',
      name: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    })

    expect(academicYear.isActive).toBe(true)
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'existing-year',
      isActive: false,
    }))
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(academicYear)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage')
  })

  test('createAcademicPeriod saves through managed path', async () => {
    const period = await service.createAcademicPeriod({
      id: 'period-1',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    })

    expect(period.id).toBe('period-1')
    expect(mockRepos.academicPeriods.save).toHaveBeenCalledWith(period)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage')
  })

  test('createAcademicPeriod rejects dates outside academic year', async () => {
    await expect(service.createAcademicPeriod({
      id: 'period-outside',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      name: 'Outside',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2025-12-01'),
      endDate: new Date('2026-03-31'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('publishAcademicPeriod saves through managed path', async () => {
    const period = await service.publishAcademicPeriod({ academicPeriodId: 'period-1' })

    expect(period.isPublished).toBe(true)
    expect(mockRepos.academicPeriods.save).toHaveBeenCalledWith(period)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage_lifecycle')
  })

  test('createClassGroup saves through managed path', async () => {
    const classGroup = await service.createClassGroup({
      id: 'cg-new',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'grade1',
      name: 'Class 1',
      capacity: 30,
      attendanceMode: AttendanceMode.Session,
      homeroomStaffId: 'staff1',
    })

    expect(classGroup.id).toBe('cg-new')
    expect(mockRepos.classGroups.save).toHaveBeenCalledWith(classGroup)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage')
  })

  test('updateClassGroupConfiguration saves through managed path after capacity check', async () => {
    const classGroup = await service.updateClassGroupConfiguration({
      classGroupId: 'cg1',
      name: 'Updated Class 1',
      capacity: 10,
      attendanceMode: AttendanceMode.Daily,
      homeroomStaffId: 'staff1',
    })

    expect(classGroup.name).toBe('Updated Class 1')
    expect(classGroup.attendanceMode).toBe(AttendanceMode.Daily)
    expect(mockRepos.enrollments.count).toHaveBeenCalledWith({
      classGroupId: 'cg1',
      status: 'active',
    })
    expect(mockRepos.classGroups.save).toHaveBeenCalledWith(classGroup)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage_lifecycle')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
  })

  test('registerStaffMember saves through managed path', async () => {
    const staffMember = await service.registerStaffMember({
      id: 'staff-new',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      roles: [StaffRole.Admin],
      email: 'grace@example.test',
    })

    expect(staffMember.id).toBe('staff-new')
    expect(staffMember.roles).toEqual([StaffRole.Admin])
    expect(mockRepos.staffMembers.save).toHaveBeenCalledWith(staffMember)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage')
  })

  test('updateStaffMemberStatus saves through managed path', async () => {
    const staffMember = await service.updateStaffMemberStatus({
      staffId: 'staff1',
      isActive: false,
    })

    expect(staffMember.id).toBe('staff1')
    expect(staffMember.isActive).toBe(false)
    expect(mockRepos.staffMembers.save).toHaveBeenCalledWith(staffMember)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage_lifecycle')
  })

  test('updateStaffMemberStatus preserves lifecycle authorization when delegating', async () => {
    const lifecyclePolicy = {
      ...mockPolicy,
      checkGlobalAction: mock(async (_actor: ActorMetadata, action: string) => {
        if (action === 'setup.manage') {
          throw new Error('setup.manage should not be required after lifecycle authorization')
        }
      }),
    } as unknown as AuthorizationPolicy
    const lifecycleService = new SchoolSetupService({ repositories: mockRepos, authorizationPolicy: lifecyclePolicy, actor } as any)

    const staffMember = await lifecycleService.updateStaffMemberStatus({
      staffId: 'staff1',
      isActive: false,
    })

    expect(staffMember.isActive).toBe(false)
    expect(lifecyclePolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage_lifecycle')
  })

  test('assignStaffToClass saves through managed path', async () => {
    const assignment = await service.assignStaffToClass({
      id: 'staff-assignment-class',
      staffId: 'staff1',
      classGroupId: 'cg1',
      role: StaffRole.Teacher,
    })

    expect(assignment.id).toBe('staff-assignment-class')
    expect(mockRepos.staffAssignments.save).toHaveBeenCalledWith(assignment)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.assign_staff')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
  })

  test('assignStaffToClassSubject saves through managed path', async () => {
    const assignment = await service.assignStaffToClassSubject({
      id: 'staff-assignment-subject',
      staffId: 'staff1',
      classSubjectId: 'cs1',
      role: StaffRole.Teacher,
    })

    expect(assignment.id).toBe('staff-assignment-subject')
    expect(mockRepos.staffAssignments.save).toHaveBeenCalledWith(assignment)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.assign_staff')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
  })

  test('assignStaffToSession saves through managed path', async () => {
    const assignment = await service.assignStaffToSession({
      id: 'staff-assignment-session',
      staffId: 'staff1',
      sessionId: 'session1',
      role: StaffRole.Teacher,
    })

    expect(assignment.id).toBe('staff-assignment-session')
    expect(mockRepos.staffAssignments.save).toHaveBeenCalledWith(assignment)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.assign_staff')
    expect(mockPolicy.checkSessionAccess).toHaveBeenCalledWith(actor, ['session1'])
  })

  test('assignResourceToClass succeeds', async () => {
    const res = await service.assignResourceToClass({
      id: 'rasgn1',
      resourceId: 'res1',
      classGroupId: 'cg1',
    })
    expect(res.id).toBe('rasgn1')
    expect(mockRepos.resourceAssignments.save).toHaveBeenCalledWith(res)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'resources.manage')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
  })

  test('assignResourceToSession succeeds', async () => {
    const res = await service.assignResourceToSession({
      id: 'rasgn-session-1',
      resourceId: 'res1',
      sessionId: 'session1',
    })
    expect(res.id).toBe('rasgn-session-1')
    expect(mockRepos.resourceAssignments.save).toHaveBeenCalledWith(res)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'resources.manage')
    expect(mockPolicy.checkSessionAccess).toHaveBeenCalledWith(actor, ['session1'])
  })

  test('removeResourceAssignment succeeds', async () => {
    await service.removeResourceAssignment({ assignmentId: 'rasgn1' })
    expect(mockRepos.resourceAssignments.delete).toHaveBeenCalledWith('rasgn1')
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'resources.manage')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
  })

  test('registerAttachment succeeds', async () => {
    const attachment = await service.registerAttachment({
      id: 'att-new',
      schoolId: 'sch1',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      fileName: 'profile.pdf',
      fileUrl: 'https://example.test/profile.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
    })
    expect(attachment.id).toBe('att-new')
    expect(attachment.uploadedById).toBe('user1')
    expect(mockRepos.attachments.save).toHaveBeenCalledWith(attachment)
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'attachments.manage')
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
  })

  test('removeAttachment succeeds', async () => {
    await service.removeAttachment({ attachmentId: 'att1' })
    expect(mockRepos.attachments.delete).toHaveBeenCalledWith('att1')
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'attachments.manage')
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
  })
})
