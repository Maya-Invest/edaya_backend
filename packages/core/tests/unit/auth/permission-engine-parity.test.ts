import type { ActorMetadata } from '../../../src/authorization'
import type { TestRole } from '../../support/effective-grants'
import { describe, expect, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  authorize,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  Permission,
} from '../../../src/authorization'
import { effectiveGrantsForRoles } from '../../support/effective-grants'

const now = new Date('2026-01-01T00:00:00Z')

function staffActor(roles: TestRole[], assuranceLevel = ActorAssuranceLevel.Strong): ActorMetadata {
  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    assuranceLevel,
    effectiveGrants: effectiveGrantsForRoles(roles),
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

function expectAuthorizeResult(
  fn: () => void,
  shouldAllow: boolean,
): void {
  if (shouldAllow) {
    expect(fn).not.toThrow()
    return
  }
  expect(fn).toThrow(AuthorizationError)
}

interface ParityCase {
  label: string
  actor: ActorMetadata
  permission: Permission
  staffRoles: TestRole[]
  shouldAllow: boolean
}

const PARITY_CASES: ParityCase[] = [
  {
    label: 'admin with verified assurance can manage finance',
    actor: staffActor(['admin'], ActorAssuranceLevel.Verified),
    permission: Permission.PAYMENT_RECORD,
    staffRoles: ['admin'],
    shouldAllow: true,
  },
  {
    label: 'coordinator can record attendance',
    actor: staffActor(['coordinator']),
    permission: Permission.ATTENDANCE_RECORD,
    staffRoles: ['coordinator'],
    shouldAllow: true,
  },
  {
    label: 'coordinator can read student health profiles',
    actor: staffActor(['coordinator']),
    permission: Permission.STUDENT_HEALTH_READ,
    staffRoles: ['coordinator'],
    shouldAllow: true,
  },
  {
    label: 'coordinator with verified assurance can update student health profiles',
    actor: staffActor(['coordinator'], ActorAssuranceLevel.Verified),
    permission: Permission.STUDENT_HEALTH_UPDATE,
    staffRoles: ['coordinator'],
    shouldAllow: true,
  },
  {
    label: 'coordinator with standard assurance cannot update student health profiles',
    actor: staffActor(['coordinator'], ActorAssuranceLevel.Standard),
    permission: Permission.STUDENT_HEALTH_UPDATE,
    staffRoles: ['coordinator'],
    shouldAllow: false,
  },
  {
    label: 'accountant can read finance',
    actor: staffActor(['accountant']),
    permission: Permission.PAYMENT_READ,
    staffRoles: ['accountant'],
    shouldAllow: true,
  },
  {
    label: 'teacher can manage student notes',
    actor: staffActor(['teacher']),
    permission: Permission.CLASS_LOGBOOK_UPDATE,
    staffRoles: ['teacher'],
    shouldAllow: true,
  },
  {
    label: 'guardian can read student detail query',
    actor: guardianActor(),
    permission: Permission.QUERY_STUDENT_DETAIL_READ,
    staffRoles: ['teacher'],
    shouldAllow: true,
  },
  {
    label: 'admin with standard assurance cannot manage finance',
    actor: staffActor(['admin'], ActorAssuranceLevel.Standard),
    permission: Permission.PAYMENT_RECORD,
    staffRoles: ['admin'],
    shouldAllow: false,
  },
  {
    label: 'teacher cannot manage finance',
    actor: staffActor(['teacher']),
    permission: Permission.PAYMENT_RECORD,
    staffRoles: ['teacher'],
    shouldAllow: false,
  },
  {
    label: 'admin cannot register platform schools through school role grants',
    actor: staffActor(['admin'], ActorAssuranceLevel.Strong),
    permission: Permission.PLATFORM_REGISTER_SCHOOL,
    staffRoles: ['admin'],
    shouldAllow: false,
  },
]

describe('permission engine system role grants', () => {
  for (const parityCase of PARITY_CASES) {
    test(parityCase.label, () => {
      const actorId = parityCase.actor.kind === 'staff'
        ? parityCase.actor.staffMemberId
        : parityCase.actor.kind === 'guardian'
          ? parityCase.actor.guardianId
          : 'unknown'

      expectAuthorizeResult(
        () => authorize({
          actor: parityCase.actor,
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
