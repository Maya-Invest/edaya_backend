import type { AuthorizationRepositories } from '@edaya/authorization'
import {
  AuthorizationError,
  Permission,
} from '@edaya/authorization'
import { describe, expect, mock, test } from 'bun:test'
import {
  checkGuardianAccess,
  checkStudentAccess,
  checkStudentHealthAccess,
  checkStudentNoteAccess,
} from '../../../../src/policy/resolvers/student'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { enrollmentRepos } from '../../../support/policy-fixtures'

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('checkStudentAccess', () => {
  test('no-ops for empty student id list', async () => {
    await checkStudentAccess(
      AuthFixtures.guardian.linkedTo('student-1'),
      [],
      enrollmentRepos('class-1'),
    )
  })
})

describe('checkGuardianAccess', () => {
  test('allows guardian self access', async () => {
    await checkGuardianAccess(
      AuthFixtures.guardian.linkedTo('student-1'),
      ['guardian-1'],
      enrollmentRepos('class-1'),
    )
  })

  test('allows staff with guardian admin permissions', async () => {
    await checkGuardianAccess(
      AuthFixtures.staff.withPermissions([Permission.PARENT_READ]),
      ['guardian-2'],
      enrollmentRepos('class-1'),
    )
  })

  test('denies portal actors for other guardians', async () => {
    await expectForbidden(checkGuardianAccess(
      AuthFixtures.guardian.linkedTo('student-1'),
      ['guardian-2'],
      enrollmentRepos('class-1'),
    ))
  })

  test('no-ops for empty guardian id list', async () => {
    await checkGuardianAccess(
      AuthFixtures.staff.withPermissions([Permission.PARENT_READ]),
      [],
      enrollmentRepos('class-1'),
    )
  })
})

describe('checkStudentNoteAccess', () => {
  test('denies non-staff actors', async () => {
    await expectForbidden(checkStudentNoteAccess(
      AuthFixtures.guardian.linkedTo('student-1'),
      ['note-1'],
      enrollmentRepos('class-1'),
    ))
  })

  test('allows staff with school-wide student note permissions', async () => {
    await checkStudentNoteAccess(
      AuthFixtures.staff.withPermissions([Permission.QUERY_STUDENT_DETAIL_READ]),
      ['note-1'],
      enrollmentRepos('class-1'),
    )
  })

  test('delegates to student access when notes exist and staff lacks school-wide grant', async () => {
    const repos = {
      ...enrollmentRepos('class-1'),
      studentNotes: {
        findByIds: mock(async (ids: readonly string[]) =>
          ids.map(id => ({ id, studentId: 'student-1' })),
        ),
      },
    } as unknown as AuthorizationRepositories
    await checkStudentNoteAccess(
      AuthFixtures.staff.withPermissions([Permission.STUDENT_READ]),
      ['note-1'],
      repos,
    )
  })

  test('denies when note ids are missing', async () => {
    const repos = {
      ...enrollmentRepos('class-1'),
      studentNotes: { findByIds: mock(async () => []) },
    } as unknown as AuthorizationRepositories
    await expectForbidden(checkStudentNoteAccess(
      AuthFixtures.staff.withPermissions([Permission.STUDENT_READ]),
      ['missing-note'],
      repos,
    ))
  })

  test('no-ops for empty note id list', async () => {
    await checkStudentNoteAccess(
      AuthFixtures.staff.withPermissions([Permission.QUERY_STUDENT_DETAIL_READ]),
      [],
      enrollmentRepos('class-1'),
    )
  })
})

describe('checkStudentHealthAccess', () => {
  test('allows staff with student health permissions', async () => {
    await checkStudentHealthAccess(
      AuthFixtures.staff.withPermissions([Permission.STUDENT_HEALTH_READ]),
      ['profile-1'],
      enrollmentRepos('class-1'),
    )
  })

  test('denies staff without student health permissions', async () => {
    await expectForbidden(checkStudentHealthAccess(
      AuthFixtures.staff.withPermissions([Permission.STUDENT_READ]),
      ['profile-1'],
      enrollmentRepos('class-1'),
    ))
  })

  test('no-ops for empty profile id list', async () => {
    await checkStudentHealthAccess(
      AuthFixtures.staff.withPermissions([Permission.STUDENT_HEALTH_READ]),
      [],
      enrollmentRepos('class-1'),
    )
  })
})
