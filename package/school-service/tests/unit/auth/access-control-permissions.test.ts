import type { ActorMetadata, AuthorizationRepositories, EffectiveGrants } from '@edaya/authorization'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createRepositoryAuthorizationPolicy,
  createStaffActorMetadata,
  Permission,
} from '@edaya/authorization'
import { noOpNotificationGateway } from '@edaya/core'
import { staffPermissionAssignmentConfig } from '@edaya/school-service'
import { describe, expect, test } from 'bun:test'

function actorWithPermissions(permissions: readonly Permission[]): ActorMetadata {
  const grants: EffectiveGrants = {
    permissions: new Set(permissions),
    scopeGrants: permissions.map(permission => ({
      permission,
      scopeType: 'school',
      scopeEntityIds: ['school-1'],
    })),
    isElevated: false,
  }

  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: new Date('2026-01-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Strong,
    effectiveGrants: grants,
  })
}

function createConfigInput() {
  const repositories = {
    staffPermissionAssignments: {},
  } as AuthorizationRepositories

  return {
    repositories,
    policy: createRepositoryAuthorizationPolicy({ repositories }),
    atomicExecution: {
      execute: async <T>(operation: () => Promise<T>) => operation(),
    },
    notificationGateway: noOpNotificationGateway,
  }
}

describe('access-control entity permissions', () => {
  test('staff permission assignments separate read from assign', async () => {
    const config = staffPermissionAssignmentConfig({
      ...createConfigInput(),
      repositories: createConfigInput().repositories as never,
    })
    const reader = actorWithPermissions([Permission.ACCESS_CONTROL_READ])
    const assigner = actorWithPermissions([Permission.ACCESS_CONTROL_ASSIGN])

    expect(config.read.checkModule(reader)).toBeUndefined()
    expect(() => config.write.checkModule(reader)).toThrow(AuthorizationError)
    expect(config.write.checkModule(assigner)).toBeUndefined()
  })
})
