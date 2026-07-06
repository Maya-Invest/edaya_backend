import type { BusinessRuleViolationError } from '../../../src/domain/shared/business-rule-error'
import { describe, expect, test } from 'bun:test'
import { assertSubjectIdAvailable } from '../../../src/application/account-linking/link-subject-to-actor'

describe('assertSubjectIdAvailable', () => {
  test('allows the same subject across different kinds in one school', async () => {
    const repositories = {
      staffMembers: {
        findOne: async () => undefined,
      },
      guardians: {
        findOne: async () => ({ id: 'guardian-1', schoolId: 'school-1', subjectId: 'user-1' }),
      },
      students: {
        findOne: async () => undefined,
      },
      teachers: {
        findOne: async () => undefined,
      },
    }

    await expect(assertSubjectIdAvailable(
      repositories as never,
      'school-1',
      'user-1',
      { subjectId: 'user-1', staffMemberId: 'staff-1' },
    )).resolves.toBeUndefined()
  })

  test('rejects duplicate staff in the same school', async () => {
    const repositories = {
      staffMembers: {
        findOne: async () => ({ id: 'staff-other', schoolId: 'school-1', subjectId: 'user-1' }),
      },
      guardians: { findOne: async () => undefined },
      students: { findOne: async () => undefined },
      teachers: { findOne: async () => undefined },
    }

    await expect(assertSubjectIdAvailable(
      repositories as never,
      'school-1',
      'user-1',
      { subjectId: 'user-1', staffMemberId: 'staff-1' },
    )).rejects.toMatchObject({
      code: 'SUBJECT_ID_ALREADY_LINKED',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('allows the same subject on the same kind in different schools', async () => {
    const repositories = {
      staffMembers: {
        findOne: async ({ schoolId }: { schoolId?: string }) =>
          schoolId === 'school-2'
            ? { id: 'staff-other', schoolId: 'school-2', subjectId: 'user-1' }
            : undefined,
      },
      guardians: { findOne: async () => undefined },
      students: { findOne: async () => undefined },
      teachers: { findOne: async () => undefined },
    }

    await expect(assertSubjectIdAvailable(
      repositories as never,
      'school-1',
      'user-1',
      { subjectId: 'user-1', staffMemberId: 'staff-1' },
    )).resolves.toBeUndefined()
  })
})
