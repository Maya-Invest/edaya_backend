import { describe, expect, mock, test } from 'bun:test'
import { AuthorizationError } from '../../../src/capabilities/authorization'
import {
  resourceGate,
  resourceGateForDelete,
  resourceGateForSave,
} from '../../../src/capabilities/authorization/gates/resource-gate'
import { AuthFixtures } from '../../support/authorization-fixtures'
import { enrollmentRepos } from '../../support/policy-fixtures'

interface StudentEntity {
  id: string
  studentId: string
}

describe('resourceGate', () => {
  test('deduplicates ids before access check', async () => {
    const check = mock(async () => {})
    const gate = resourceGate<StudentEntity>(
      check,
      entity => entity.studentId,
    )

    await gate(
      AuthFixtures.guardian.linkedTo('student-1'),
      [{ id: 'a', studentId: 'student-1' }, { id: 'b', studentId: 'student-1' }],
      enrollmentRepos(),
    )

    expect(check).toHaveBeenCalledTimes(1)
    const firstCall = check.mock.calls[0] as [unknown, readonly string[]] | undefined
    expect(firstCall?.[1]).toEqual(['student-1'])
  })

  test('no-ops when selected ids are empty', async () => {
    const check = mock(async () => {})
    const gate = resourceGate<StudentEntity>(check, () => [])

    await gate(AuthFixtures.guardian.linkedTo('student-1'), [{ id: 'a', studentId: 'student-1' }], enrollmentRepos())
    expect(check).not.toHaveBeenCalled()
  })
})

describe('resourceGateForSave', () => {
  test('resolves ids from entity and existing rows', async () => {
    const check = mock(async () => {})
    const gate = resourceGateForSave<StudentEntity>(
      check,
      async entity => [entity.studentId],
    )

    await gate(
      AuthFixtures.guardian.linkedTo('student-1'),
      { id: 'a', studentId: 'student-1' },
      undefined,
      enrollmentRepos(),
    )

    expect(check).toHaveBeenCalledTimes(1)
  })
})

describe('resourceGateForDelete', () => {
  test('propagates authorization failures from delete resolver', async () => {
    const gate = resourceGateForDelete<StudentEntity>(
      async () => {
        throw new AuthorizationError('forbidden' as never)
      },
      async entity => [entity.studentId],
    )

    await expect(gate(
      AuthFixtures.guardian.linkedTo('student-1'),
      { id: 'a', studentId: 'student-2' },
      enrollmentRepos(),
    )).rejects.toBeInstanceOf(AuthorizationError)
  })
})
