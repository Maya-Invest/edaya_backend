import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import type { ActorMetadata } from '../../../../src/services/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { StudentDisciplinaryActionStatus } from '../../../../src/entities/students/student-disciplinary-action'
import { BehaviorService } from '../../../../src/services/modules/behavior'

describe('BehaviorService', () => {
  const mockRepos = {
    studentDisciplinaryActions: {
      findById: mock(async (id) => {
        if (id === 'action1') {
          return {
            id: 'action1',
            schoolId: 'sch1',
            incidentId: 'inc1',
            studentId: 'stu1',
            disciplinaryActionId: 'da1',
            assignedByStaffId: 'staff1',
            startsAt: new Date(),
            endsAt: new Date(),
            status: StudentDisciplinaryActionStatus.Active,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        }
        return undefined
      }),
      save: mock(async () => {}),
    },
    incidents: {
      findById: mock(async () => ({
        id: 'inc1',
        schoolId: 'sch1',
        classGroupId: 'cg1',
        sessionId: 'sess1',
      })),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = { requirePermission: mock(async () => {}) } as unknown as AuthorizationPolicy
  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'sch1',
    requestId: 'req1',
    reason: 'test',
  }

  const service = new BehaviorService({ repositories: mockRepos, authorizationPolicy: mockPolicy, actor } as any)

  test('updateStudentDisciplinaryActionStatus updates the status', async () => {
    const res = await service.updateStudentDisciplinaryActionStatus({
      studentDisciplinaryActionId: 'action1',
      status: StudentDisciplinaryActionStatus.Completed,
    })
    expect(res.status).toBe(StudentDisciplinaryActionStatus.Completed)
  })

  test('updateStudentDisciplinaryActionStatus throws if not found', async () => {
    expect(
      service.updateStudentDisciplinaryActionStatus({
        studentDisciplinaryActionId: 'invalid',
        status: StudentDisciplinaryActionStatus.Completed,
      }),
    ).rejects.toThrow()
  })
})
