import type { ActorMetadata, EffectiveGrants } from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createRepositoryAuthorizationPolicy,
  createStaffActorMetadata,
  Permission,
} from '../../../src/authorization'
import { accessRoleConfig, staffRoleAssignmentConfig } from '../../../src/domains'
import { noOpNotificationGateway } from '../../../src/notifications'

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
    accessRoles: {},
    staffRoleAssignments: {},
  } as SchoolRepositories

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
  test('access roles separate read from configure', async () => {
    const config = accessRoleConfig(createConfigInput())
    const reader = actorWithPermissions([Permission.ACCESS_CONTROL_READ])
    const configurer = actorWithPermissions([Permission.ACCESS_CONTROL_CONFIGURE])

    expect(config.read.checkModule(reader)).toBeUndefined()
    expect(() => config.write.checkModule(reader)).toThrow(AuthorizationError)
    expect(config.write.checkModule(configurer)).toBeUndefined()
  })

  test('staff role assignments separate read from assign', async () => {
    const config = staffRoleAssignmentConfig(createConfigInput())
    const reader = actorWithPermissions([Permission.ACCESS_CONTROL_READ])
    const assigner = actorWithPermissions([Permission.ACCESS_CONTROL_ASSIGN])

    expect(config.read.checkModule(reader)).toBeUndefined()
    expect(() => config.write.checkModule(reader)).toThrow(AuthorizationError)
    expect(config.write.checkModule(assigner)).toBeUndefined()
  })
})
