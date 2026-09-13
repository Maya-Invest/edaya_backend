import type { AuthorizationRepositories } from '@edaya/authorization'
import {
  AuthorizationError,
  createSystemActorMetadata,
  Permission,
} from '@edaya/authorization'
import { AttachmentOwnerKind } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { checkAttachmentAccess } from '../../../../src/policy/resolvers/attachment'
import { checkTeacherAccess } from '../../../../src/policy/resolvers/teacher'
import { checkTeacherAssignmentAccess } from '../../../../src/policy/resolvers/teacher-assignment'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { enrollmentRepos } from '../../../support/policy-fixtures'

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('checkTeacherAccess', () => {
  test('allows system actor', async () => {
    await checkTeacherAccess(
      createSystemActorMetadata({
        schoolId: 'school-1',
        systemId: 'account-invitation-public',
        requestId: 'test',
        reason: 'public-invitation-accept',
      }),
      ['teacher-2'],
      enrollmentRepos(),
    )
  })

  test('allows teacher self access without staff grants', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await checkTeacherAccess(actor, ['teacher-1'], enrollmentRepos())
  })

  test('denies non-self teacher access without staff admin grants', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await expectForbidden(checkTeacherAccess(actor, ['teacher-2'], enrollmentRepos()))
  })

  test('allows staff with school-wide teacher admin permissions', async () => {
    const actor = AuthFixtures.staff.withPermissions([
      Permission.ACCESS_CONTROL_ASSIGN,
      Permission.SCHOOL_STRUCTURE_CONFIGURE,
    ])
    await checkTeacherAccess(actor, ['teacher-2'], enrollmentRepos())
  })
})

describe('checkTeacherAssignmentAccess', () => {
  test('allows teacher to read own assignment rows', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await checkTeacherAssignmentAccess(actor, [{ teacherId: 'teacher-1' }])
  })

  test('denies teacher for another teacher assignment without staff assign permission', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await expectForbidden(checkTeacherAssignmentAccess(actor, [{ teacherId: 'teacher-2' }]))
  })

  test('allows staff with access-control assign operation permission', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.ACCESS_CONTROL_ASSIGN])
    await checkTeacherAssignmentAccess(actor, [{ teacherId: 'teacher-2' }])
  })
})

describe('checkAttachmentAccess', () => {
  test('allows staff with attachment read permission without portal lookup', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.ATTACHMENT_READ])
    await checkAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: 'staff-1',
    }], enrollmentRepos())
  })

  test('routes portal actors through portal attachment access', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await checkAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-1',
    }], enrollmentRepos('class-1'))
  })

  test('denies unsupported actor kinds', async () => {
    const repos = enrollmentRepos()
    await expectForbidden(checkAttachmentAccess({
      kind: 'system',
      actorId: 'system',
      schoolId: 'school-1',
      requestId: 'test',
    } as never, [{
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-1',
    }], repos))
  })

  test('no-ops for empty attachment list', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.ATTACHMENT_READ])
    await checkAttachmentAccess(actor, [], {} as AuthorizationRepositories)
  })
})
