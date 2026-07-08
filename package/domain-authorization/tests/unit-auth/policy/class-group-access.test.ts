import type { AuthorizationRepositories } from '@edaya/authorization'
import { AuthorizationError, dispatchClassGroupAccess, Permission } from '@edaya/authorization'
import { describe, expect, mock, test } from 'bun:test'
import { checkClassGroupAccess } from '../../../src/policy/resolvers/academic'
import { AuthFixtures } from '../../support/authorization-fixtures'

function classSubjectRepos(classGroupId = 'class-1'): AuthorizationRepositories {
  return {
    classSubjects: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId })),
      ),
    },
    staffAssignments: {
      list: mock(async () => []),
    },
  } as unknown as AuthorizationRepositories
}

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('dispatchClassGroupAccess', () => {
  test('allows guardian in linked class group', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    await dispatchClassGroupAccess(actor, ['class-1'], classSubjectRepos())
  })

  test('denies guardian for unlinked class group', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    await expectForbidden(dispatchClassGroupAccess(actor, ['class-2'], classSubjectRepos()))
  })

  test('allows student enrolled in class group', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1')
    await dispatchClassGroupAccess(actor, ['class-1'], classSubjectRepos())
  })

  test('denies student for other class group', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1')
    await expectForbidden(dispatchClassGroupAccess(actor, ['class-2'], classSubjectRepos()))
  })

  test('allows teacher homeroom class group', async () => {
    const actor = AuthFixtures.teacher.homeroom('class-1')
    await dispatchClassGroupAccess(actor, ['class-1'], classSubjectRepos('class-1'))
  })

  test('allows teacher subject class group via classSubjects lookup', async () => {
    const actor = AuthFixtures.teacher.subject('cs-math', [])
    await dispatchClassGroupAccess(actor, ['class-1'], classSubjectRepos('class-1'))
  })

  test('denies unassigned teacher', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await expectForbidden(dispatchClassGroupAccess(actor, ['class-1'], classSubjectRepos()))
  })

  test('allows staff with class group scoped grant', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.GRADE_READ])
    await dispatchClassGroupAccess(actor, ['class-1'], classSubjectRepos())
  })

  test('checkClassGroupAccess delegates to compose', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1')
    await checkClassGroupAccess(actor, ['class-1'], classSubjectRepos())
  })
})
