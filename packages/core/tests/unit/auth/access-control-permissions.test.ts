import type { ActorMetadata, EffectiveGrants } from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
  Permission,
  RepositoryAuthorizationPolicy,
} from '../../../src/authorization'
import { accessRoleConfig } from '../../../src/services/entity-configs/school/access-role'
import { staffRoleAssignmentConfig } from '../../../src/services/entity-configs/school/staff-role-assignment'

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
    policy: new RepositoryAuthorizationPolicy({ repositories }),
    atomicExecution: {
      execute: async <T>(operation: () => Promise<T>) => operation(),
    },
  }
}

describe('access-control entity permissions', () => {
  test('access roles separate read from configure', async () => {
    const config = accessRoleConfig(createConfigInput())
    const reader = actorWithPermissions([Permission.ACCESS_CONTROL_READ])
    const configurer = actorWithPermissions([Permission.ACCESS_CONTROL_CONFIGURE])

    await expect(config.read.checkModule(reader)).resolves.toBeUndefined()
    await expect(config.write.checkModule(reader)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(config.write.checkModule(configurer)).resolves.toBeUndefined()
  })

  test('staff role assignments separate read from assign', async () => {
    const config = staffRoleAssignmentConfig(createConfigInput())
    const reader = actorWithPermissions([Permission.ACCESS_CONTROL_READ])
    const assigner = actorWithPermissions([Permission.ACCESS_CONTROL_ASSIGN])

    await expect(config.read.checkModule(reader)).resolves.toBeUndefined()
    await expect(config.write.checkModule(reader)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(config.write.checkModule(assigner)).resolves.toBeUndefined()
  })
})
