import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import type { ActorMetadata } from '../../../../src/services/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { SchoolSetupService } from '../../../../src/services/commands/setup'

describe('SetupService', () => {
  const mockRepos = {
    academicYears: {
      save: mock(async () => {}),
      findById: mock(async id => ({ id, schoolId: 'sch1', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })),
    },
    schools: {
      findById: mock(async id => ({ id })),
    },
    classGroups: {
      findById: mock(async id => ({ id, schoolId: 'sch1', academicYearId: 'ay1' })),
    },
    students: {
      findById: mock(async id => ({ id, schoolId: 'sch1' })),
    },
    enrollments: {
      findOne: mock(async () => ({ classGroupId: 'cg1' })),
    },
    resources: {
      save: mock(async () => {}),
      findById: mock(async id => ({ id, schoolId: 'sch1', kind: 'Room' })),
    },
    resourceAssignments: {
      save: mock(async () => {}),
      findById: mock(async id => ({ id, resourceId: 'res1', classGroupId: 'cg1' })),
      list: mock(async () => []),
    },
    attachments: {
      save: mock(async () => {}),
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

  test('assignResourceToClass succeeds', async () => {
    const res = await service.assignResourceToClass({
      id: 'rasgn1',
      resourceId: 'res1',
      classGroupId: 'cg1',
    })
    expect(res.id).toBe('rasgn1')
  })

  test('removeResourceAssignment succeeds', async () => {
    await service.removeResourceAssignment({ assignmentId: 'rasgn1' })
    expect(true).toBe(true)
  })

  test('removeAttachment succeeds', async () => {
    await service.removeAttachment({ attachmentId: 'att1' })
    expect(true).toBe(true)
  })
})
