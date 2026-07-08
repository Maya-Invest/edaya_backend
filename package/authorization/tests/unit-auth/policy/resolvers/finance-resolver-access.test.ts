import type { AuthorizationRepositories } from '@edaya/authorization'
import {
  AuthorizationError,
  Permission,
} from '@edaya/authorization'
import { describe, expect, mock, test } from 'bun:test'
import {
  checkFeeAccess,
  checkStudentFeeAccess,
} from '../../../../src/policy/resolvers/finance'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { enrollmentRepos, feeCatalogRepos } from '../../../support/policy-fixtures'

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('checkFeeAccess', () => {
  test('delegates to fee access strategy for guardian actors', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await checkFeeAccess(actor, ['fee-1'], feeCatalogRepos({ 'fee-1': ['student-1'] }))
  })
})

describe('checkStudentFeeAccess', () => {
  test('no-ops for empty student fee id list', async () => {
    await checkStudentFeeAccess(
      AuthFixtures.guardian.linkedTo('student-1'),
      [],
      enrollmentRepos('class-1'),
    )
  })

  test('allows staff with school-wide student fee permissions', async () => {
    await checkStudentFeeAccess(
      AuthFixtures.staff.withPermissions([Permission.PAYMENT_READ]),
      ['student-fee-1'],
      enrollmentRepos('class-1'),
    )
  })

  test('delegates to student access for portal actors', async () => {
    const repos = {
      ...feeCatalogRepos({ 'fee-1': ['student-1'] }),
      studentFees: {
        findByIds: mock(async (ids: readonly string[]) =>
          ids.map(id => ({ id, studentId: 'student-1', feeId: 'fee-1' })),
        ),
      },
    } as unknown as AuthorizationRepositories

    await checkStudentFeeAccess(
      AuthFixtures.guardian.linkedTo('student-1'),
      ['student-fee-1'],
      repos,
    )
  })

  test('denies when student fee rows are missing', async () => {
    const repos = {
      ...enrollmentRepos('class-1'),
      studentFees: { findByIds: mock(async () => []) },
    } as unknown as AuthorizationRepositories

    await expectForbidden(checkStudentFeeAccess(
      AuthFixtures.guardian.linkedTo('student-1'),
      ['missing-fee'],
      repos,
    ))
  })
})
