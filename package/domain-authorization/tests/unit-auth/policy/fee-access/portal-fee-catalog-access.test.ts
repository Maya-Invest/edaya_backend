import type { AuthorizationRepositories } from '@edaya/authorization'
import {
  AuthorizationError,
  Permission,
} from '@edaya/authorization'
import { describe, expect, mock, test } from 'bun:test'
import { dispatchFeeAccess } from '../../../../src/policy/strategies/fee-access'
import { portalFeeCatalogAccess } from '../../../../src/policy/strategies/fee-access/portal-catalog'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { enrollmentRepos, feeCatalogRepos } from '../../../support/policy-fixtures'

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('portalFeeCatalogAccess', () => {
  test('allows guardian when fee is linked to a linked student', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    const repos = feeCatalogRepos({ 'fee-1': ['student-1'] }, enrollmentRepos('class-1'))
    await portalFeeCatalogAccess(actor, ['fee-1'], repos)
  })

  test('denies guardian when fee is only linked to an unlinked student', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    const repos = feeCatalogRepos({ 'fee-1': ['student-2'] }, enrollmentRepos('class-1'))
    await expectForbidden(portalFeeCatalogAccess(actor, ['fee-1'], repos))
  })

  test('denies portal actor when fee has no student fee rows', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      studentFees: {
        list: mock(async () => []),
      },
    } as unknown as AuthorizationRepositories
    await expectForbidden(portalFeeCatalogAccess(actor, ['fee-orphan'], repos))
  })

  test('allows student self when fee is linked to that student', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    const repos = feeCatalogRepos({ 'fee-1': ['student-1'] }, enrollmentRepos('class-1'))
    await portalFeeCatalogAccess(actor, ['fee-1'], repos)
  })

  test('allows teacher homeroom when fee is linked to a class student', async () => {
    const actor = AuthFixtures.teacher.homeroom('class-1')
    const repos = feeCatalogRepos({ 'fee-1': ['student-1'] }, enrollmentRepos('class-1'))
    await portalFeeCatalogAccess(actor, ['fee-1'], repos)
  })
})

describe('dispatchFeeAccess', () => {
  test('allows staff with school-wide fee permissions', async () => {
    const actor = AuthFixtures.staff.withPermissions([
      Permission.FINANCIAL_CONFIG_READ,
      Permission.PAYMENT_READ,
    ])
    const repos = feeCatalogRepos({ 'fee-1': ['student-1'] })
    await dispatchFeeAccess(actor, ['fee-1'], repos)
  })

  test('denies staff without school-wide fee permissions', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_READ])
    const repos = feeCatalogRepos({ 'fee-1': ['student-1'] })
    await expectForbidden(dispatchFeeAccess(actor, ['fee-1'], repos))
  })

  test('no-ops for empty fee id list', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await dispatchFeeAccess(actor, [], feeCatalogRepos({}))
  })

  test('routes guardian student and teacher actors through portal fee catalog', async () => {
    const repos = feeCatalogRepos({ 'fee-1': ['student-1'] }, enrollmentRepos('class-1'))
    await dispatchFeeAccess(AuthFixtures.guardian.linkedTo('student-1'), ['fee-1'], repos)
    await dispatchFeeAccess(AuthFixtures.student.enrolledIn('class-1', 'student-1'), ['fee-1'], repos)
    await dispatchFeeAccess(AuthFixtures.teacher.homeroom('class-1'), ['fee-1'], repos)
  })
})
