import type { ActorMetadata } from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  authorize,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  Permission,
  RepositoryAuthorizationPolicy,
  SYSTEM_ROLE_PERMISSIONS,
  systemAccessRoleId,
  systemRoleAssignmentId,
} from '../../../src/authorization'
import { AccessRole, StaffRole, StaffRoleAssignment } from '../../../src/entities'

const now = new Date('2026-01-01T00:00:00Z')

function staffActor(roles: StaffRole[], assuranceLevel = ActorAssuranceLevel.Strong): ActorMetadata {
  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    assuranceLevel,
    roles,
  })
}

function guardianActor(): ActorMetadata {
  return createGuardianActorMetadata({
    subjectId: 'subject-guardian',
    guardianId: 'guardian-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
  })
}

function createRepos(staffRoles: StaffRole[]): SchoolRepositories {
  const accessRoles = Object.values(StaffRole).map(role => new AccessRole({
    id: systemAccessRoleId('school-1', role),
    schoolId: 'school-1',
    name: role,
    isSystemRole: true,
    systemRoleKey: role,
    permissions: SYSTEM_ROLE_PERMISSIONS[role],
  }))
  const assignment = new StaffRoleAssignment({
    id: systemRoleAssignmentId('school-1', 'staff-1'),
    staffId: 'staff-1',
    schoolId: 'school-1',
    roleIds: staffRoles.map(role => systemAccessRoleId('school-1', role)),
    scopeGrants: [],
  })

  return {
    staffMembers: {
      findById: mock(async () => ({
        id: 'staff-1',
        schoolId: 'school-1',
        isActive: true,
      })),
    },
    staffAssignments: {
      list: mock(async () => []),
    },
    accessRoles: {
      findById: mock(async (id: string) => accessRoles.find(role => role.id === id)),
      findByIds: mock(async (ids: string[]) => accessRoles.filter(role => ids.includes(role.id))),
      list: mock(async () => accessRoles),
      save: mock(async () => {}),
    },
    staffRoleAssignments: {
      findById: mock(async (id: string) => id === assignment.id ? assignment : undefined),
      findByIds: mock(async (ids: string[]) => ids.includes(assignment.id) ? [assignment] : []),
      list: mock(async () => [assignment]),
      save: mock(async () => {}),
    },
  } as unknown as SchoolRepositories
}

async function expectAuthorizeResult(
  operation: Promise<void>,
  shouldAllow: boolean,
): Promise<void> {
  if (shouldAllow) {
    await expect(operation).resolves.toBeUndefined()
    return
  }
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

interface ParityCase {
  label: string
  actor: ActorMetadata
  permission: Permission
  staffRoles: StaffRole[]
  shouldAllow: boolean
}

const PARITY_CASES: ParityCase[] = [
  {
    label: 'admin with verified assurance can manage finance',
    actor: staffActor([StaffRole.Admin], ActorAssuranceLevel.Verified),
    permission: Permission.PAYMENT_RECORD,
    staffRoles: [StaffRole.Admin],
    shouldAllow: true,
  },
  {
    label: 'coordinator can record attendance',
    actor: staffActor([StaffRole.Coordinator]),
    permission: Permission.ATTENDANCE_RECORD,
    staffRoles: [StaffRole.Coordinator],
    shouldAllow: true,
  },
  {
    label: 'coordinator can read student health profiles',
    actor: staffActor([StaffRole.Coordinator]),
    permission: Permission.STUDENT_HEALTH_READ,
    staffRoles: [StaffRole.Coordinator],
    shouldAllow: true,
  },
  {
    label: 'coordinator with verified assurance can update student health profiles',
    actor: staffActor([StaffRole.Coordinator], ActorAssuranceLevel.Verified),
    permission: Permission.STUDENT_HEALTH_UPDATE,
    staffRoles: [StaffRole.Coordinator],
    shouldAllow: true,
  },
  {
    label: 'coordinator with standard assurance cannot update student health profiles',
    actor: staffActor([StaffRole.Coordinator], ActorAssuranceLevel.Standard),
    permission: Permission.STUDENT_HEALTH_UPDATE,
    staffRoles: [StaffRole.Coordinator],
    shouldAllow: false,
  },
  {
    label: 'accountant can read finance',
    actor: staffActor([StaffRole.Accountant]),
    permission: Permission.PAYMENT_READ,
    staffRoles: [StaffRole.Accountant],
    shouldAllow: true,
  },
  {
    label: 'teacher can manage student notes',
    actor: staffActor([StaffRole.Teacher]),
    permission: Permission.CLASS_LOGBOOK_UPDATE,
    staffRoles: [StaffRole.Teacher],
    shouldAllow: true,
  },
  {
    label: 'guardian can read student detail query',
    actor: guardianActor(),
    permission: Permission.QUERY_STUDENT_DETAIL_READ,
    staffRoles: [StaffRole.Teacher],
    shouldAllow: true,
  },
  {
    label: 'admin with standard assurance cannot manage finance',
    actor: staffActor([StaffRole.Admin], ActorAssuranceLevel.Standard),
    permission: Permission.PAYMENT_RECORD,
    staffRoles: [StaffRole.Admin],
    shouldAllow: false,
  },
  {
    label: 'teacher cannot manage finance',
    actor: staffActor([StaffRole.Teacher]),
    permission: Permission.PAYMENT_RECORD,
    staffRoles: [StaffRole.Teacher],
    shouldAllow: false,
  },
  {
    label: 'admin cannot register platform schools through school role grants',
    actor: staffActor([StaffRole.Admin], ActorAssuranceLevel.Strong),
    permission: Permission.PLATFORM_REGISTER_SCHOOL,
    staffRoles: [StaffRole.Admin],
    shouldAllow: false,
  },
]

describe('permission engine system role grants', () => {
  for (const parityCase of PARITY_CASES) {
    test(parityCase.label, async () => {
      const repos = createRepos(parityCase.staffRoles)
      const policy = new RepositoryAuthorizationPolicy({ repositories: repos })
      const actorId = parityCase.actor.kind === 'staff'
        ? parityCase.actor.staffMemberId
        : parityCase.actor.kind === 'guardian'
          ? parityCase.actor.guardianId
          : 'unknown'

      await expectAuthorizeResult(
        authorize({
          actor: parityCase.actor,
          policy,
          repositories: repos,
          request: {
            actorId,
            schoolId: 'school-1',
            permission: parityCase.permission,
          },
        }),
        parityCase.shouldAllow,
      )
    })
  }
})
