import type { BusinessRuleViolationError } from '@edaya/core'
import { assertSubjectIdAvailable } from '@edaya/school-service'
import { describe, expect, test } from 'bun:test'

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

  test('rejects duplicate guardian, student, and teacher links in the same school', async () => {
    const duplicate = (id: string) => ({
      findOne: async () => ({ id, schoolId: 'school-1', subjectId: 'user-1' }),
    })
    const empty = { findOne: async () => undefined }

    await expect(assertSubjectIdAvailable(
      { staffMembers: empty, guardians: duplicate('guardian-other'), students: empty, teachers: empty } as never,
      'school-1',
      'user-1',
      { subjectId: 'user-1', guardianId: 'guardian-1' },
    )).rejects.toMatchObject({ code: 'SUBJECT_ID_ALREADY_LINKED' } satisfies Partial<BusinessRuleViolationError>)

    await expect(assertSubjectIdAvailable(
      { staffMembers: empty, guardians: empty, students: duplicate('student-other'), teachers: empty } as never,
      'school-1',
      'user-1',
      { subjectId: 'user-1', studentId: 'student-1' },
    )).rejects.toMatchObject({ code: 'SUBJECT_ID_ALREADY_LINKED' } satisfies Partial<BusinessRuleViolationError>)

    await expect(assertSubjectIdAvailable(
      { staffMembers: empty, guardians: empty, students: empty, teachers: duplicate('teacher-other') } as never,
      'school-1',
      'user-1',
      { subjectId: 'user-1', teacherId: 'teacher-1' },
    )).rejects.toMatchObject({ code: 'SUBJECT_ID_ALREADY_LINKED' } satisfies Partial<BusinessRuleViolationError>)
  })
})
