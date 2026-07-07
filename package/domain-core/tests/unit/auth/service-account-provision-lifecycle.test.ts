import { describe, expect, mock, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
  Permission,
} from '../../../src/capabilities/authorization'
import {
  createServiceAccount,
  listServiceAccounts,
  revokeServiceAccount,
  rotateServiceAccountKey,
  updateServiceAccount,
} from '../../../src/capabilities/authorization/service-accounts/provision'
import { BusinessRuleViolationError } from '../../../src/domain/shared/business-rule-error'
import { effectiveGrantsForRoles } from '../../support/effective-grants'

const now = new Date('2026-09-01T00:00:00Z')

function adminActor() {
  return createStaffActorMetadata({
    subjectId: 'subject-admin',
    staffMemberId: 'staff-admin',
    schoolId: 'school-1',
    requestId: 'test',
    authenticatedAt: now,
    assuranceLevel: ActorAssuranceLevel.Strong,
    effectiveGrants: effectiveGrantsForRoles(['admin']),
  })
}

function createProvisionRepositories() {
  const staffMembers: unknown[] = []
  const serviceApiKeys: unknown[] = []
  const staffPermissionAssignments: unknown[] = []

  return {
    repositories: {
      staffMembers: {
        findOne: mock(async (): Promise<{ id: string } | undefined> => undefined),
        findById: mock(async (id: string) => (staffMembers as { id: string }[]).find(member => member.id === id)),
        save: mock(async (member: unknown) => {
          const typedMember = member as { id: string }
          const index = (staffMembers as { id: string }[]).findIndex(entry => entry.id === typedMember.id)
          if (index >= 0) {
            staffMembers[index] = member
          }
          else {
            staffMembers.push(member)
          }
          return member
        }),
        list: mock(async () => staffMembers),
      },
      serviceApiKeys: {
        countActiveElevatedServiceAccounts: mock(async () => 0),
        save: mock(async (key: unknown) => {
          serviceApiKeys.push(key)
          return key
        }),
        list: mock(async ({ staffMemberId }: { staffMemberId: string }) =>
          (serviceApiKeys as { staffMemberId: string }[]).filter(key => key.staffMemberId === staffMemberId),
        ),
      },
      staffPermissionAssignments: {
        save: mock(async (assignment: unknown) => {
          staffPermissionAssignments.push(assignment)
          return assignment
        }),
        list: mock(async () => staffPermissionAssignments),
        delete: mock(async () => {}),
      },
    },
    staffMembers,
    serviceApiKeys,
    staffPermissionAssignments,
  }
}

describe('createServiceAccount', () => {
  test('creates delegated service account with permission assignments', async () => {
    const { repositories } = createProvisionRepositories()
    const result = await createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'seeding',
      displayName: 'Seeding Integration',
      permissionAssignments: [{
        permission: Permission.GRADE_INPUT,
        scopeIds: 'class-1',
        academicYearId: 'year-1',
      }],
    })

    expect(result.apiKey).toMatch(/^sk_/)
    expect(result.staffMember.accountKind).toBe('service')
    expect(result.staffMember.serviceId).toBe('seeding')
  })

  test('rejects non-elevated service account without permission assignments', async () => {
    const { repositories } = createProvisionRepositories()
    await expect(createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'empty',
      displayName: 'Empty Service',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('rejects duplicate service id within school', async () => {
    const { repositories } = createProvisionRepositories()
    repositories.staffMembers.findOne = mock(async () => ({ id: 'existing' }))

    await expect(createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'seeding',
      displayName: 'Duplicate',
      elevated: true,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('rejects second elevated service account for the same school', async () => {
    const { repositories } = createProvisionRepositories()
    repositories.serviceApiKeys.countActiveElevatedServiceAccounts = mock(async () => 1)

    await expect(createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'owner-2',
      displayName: 'Owner Two',
      elevated: true,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})

describe('updateServiceAccount', () => {
  test('updates display name for active service account', async () => {
    const { repositories, staffMembers } = createProvisionRepositories()
    const created = await createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'reports',
      displayName: 'Reports',
      elevated: true,
    })
    staffMembers.length = 0
    staffMembers.push(created.staffMember)

    const updated = await updateServiceAccount(
      repositories as never,
      adminActor(),
      created.staffMember.id,
      { displayName: 'Reports v2' },
    )

    expect(updated.firstName).toBe('Reports')
    expect(updated.lastName).toBe('v2')
  })

  test('updates permission assignments for active service account', async () => {
    const { repositories, staffMembers } = createProvisionRepositories()
    const created = await createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'reports',
      displayName: 'Reports',
      elevated: true,
    })
    staffMembers.length = 0
    staffMembers.push(created.staffMember)

    await updateServiceAccount(
      repositories as never,
      adminActor(),
      created.staffMember.id,
      {
        permissionAssignments: [{
          permission: Permission.GRADE_INPUT,
          scopeIds: 'class-1',
          academicYearId: 'year-1',
        }],
      },
    )
  })

  test('rejects empty update payload', async () => {
    const { repositories } = createProvisionRepositories()
    await expect(updateServiceAccount(
      repositories as never,
      adminActor(),
      'missing',
      {},
    )).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})

describe('listServiceAccounts', () => {
  test('lists service accounts for school', async () => {
    const { repositories } = createProvisionRepositories()
    await createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'cron',
      displayName: 'Cron',
      elevated: true,
    })

    const accounts = await listServiceAccounts(repositories as never, adminActor())
    expect(accounts).toHaveLength(1)
  })
})

describe('revokeServiceAccount', () => {
  test('deactivates service account and revokes active keys', async () => {
    const { repositories, staffMembers } = createProvisionRepositories()
    const created = await createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'mobile',
      displayName: 'Mobile',
      elevated: true,
      apiKey: 'sk_live_test_mobile_key_123456789012345678901234',
    })
    staffMembers.length = 0
    staffMembers.push(created.staffMember)

    const revoked = await revokeServiceAccount(repositories as never, adminActor(), created.staffMember.id)
    expect(revoked.isActive).toBe(false)
  })
})

describe('rotateServiceAccountKey', () => {
  test('revokes prior keys and returns a new api key', async () => {
    const { repositories, staffMembers } = createProvisionRepositories()
    const created = await createServiceAccount(repositories as never, adminActor(), {
      serviceId: 'webhook',
      displayName: 'Webhook',
      elevated: true,
      apiKey: 'sk_live_test_webhook_key_123456789012345678901234',
    })
    staffMembers.length = 0
    staffMembers.push(created.staffMember)

    const rotated = await rotateServiceAccountKey(repositories as never, adminActor(), created.staffMember.id)
    expect(rotated.apiKey).toMatch(/^sk_/)
    expect(rotated.apiKey).not.toBe(created.apiKey)
  })
})

describe('createServiceAccount authorization', () => {
  test('rejects creators without service account create permission', async () => {
    const { repositories } = createProvisionRepositories()
    const actor = createStaffActorMetadata({
      subjectId: 'subject-teacher',
      staffMemberId: 'staff-teacher',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: effectiveGrantsForRoles(['teacher']),
    })

    await expect(createServiceAccount(repositories as never, actor, {
      serviceId: 'blocked',
      displayName: 'Blocked',
      elevated: true,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
