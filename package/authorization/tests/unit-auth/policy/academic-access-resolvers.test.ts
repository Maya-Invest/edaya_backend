import type { AuthorizationRepositories } from '@edaya/authorization'
import type { ReportCardResult } from '@edaya/core'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
  Permission,
} from '@edaya/authorization'
import { ReportCardResultStatus } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'
import {
  authorizeReportCardResultSave,
  checkAssessmentAccess,
  checkClassGroupAccess,
  checkReportCardResultAccess,
} from '../../../src/policy/resolvers/academic'
import { AuthFixtures } from '../../support/authorization-fixtures'
import { enrollmentRepos } from '../../support/policy-fixtures'

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

function assessmentRepos(): AuthorizationRepositories {
  return {
    ...enrollmentRepos('class-1'),
    assessments: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({
          id,
          classGroupId: 'class-1',
          classSubjectId: 'cs-1',
        })),
      ),
    },
    results: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({
          id,
          studentId: 'student-1',
          classGroupId: 'class-1',
          reportCardDefinitionId: 'rcd-1',
          periodId: 'period-1',
          attendanceSummary: { present: 1, absent: 0, late: 0, excused: 0 },
          assessmentResultCount: 0,
          status: ReportCardResultStatus.Draft,
          generatedAt: new Date('2026-09-01T00:00:00Z'),
          sectionResults: [],
        })),
      ),
    },
  } as unknown as AuthorizationRepositories
}

describe('checkClassGroupAccess', () => {
  test('delegates to compose for guardian actors', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    await checkClassGroupAccess(actor, ['class-1'], enrollmentRepos('class-1'))
  })
})

describe('checkAssessmentAccess', () => {
  test('allows guardian when assessments belong to linked class group', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    await checkAssessmentAccess(actor, ['assessment-1'], assessmentRepos())
  })

  test('allows teacher assigned to assessment class subject', async () => {
    const actor = AuthFixtures.teacher.subject('cs-1', ['class-1'])
    await checkAssessmentAccess(actor, ['assessment-1'], assessmentRepos())
  })

  test('allows staff with school-wide assessment permissions', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.GRADE_READ])
    await checkAssessmentAccess(actor, ['assessment-1'], assessmentRepos())
  })

  test('denies teacher for unassigned class subject', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await expectForbidden(checkAssessmentAccess(actor, ['assessment-1'], assessmentRepos()))
  })

  test('allows student when assessments belong to enrolled class group', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    await checkAssessmentAccess(actor, ['assessment-1'], assessmentRepos())
  })

  test('denies student when assessment lookup is incomplete', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    const repos = {
      ...assessmentRepos(),
      assessments: { findByIds: mock(async () => []) },
    } as unknown as AuthorizationRepositories
    await expectForbidden(checkAssessmentAccess(actor, ['missing'], repos))
  })

  test('allows staff with class-scoped assessment permissions', async () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.GRADE_READ]),
        scopeGrants: [{
          permission: Permission.GRADE_READ,
          scopeType: 'class_group',
          scopeEntityIds: ['class-1'],
        }],
        scopeIdsByPermission: { [Permission.GRADE_READ]: 'class-1' },
        isElevated: false,
      },
    })
    await checkAssessmentAccess(actor, ['assessment-1'], assessmentRepos())
  })

  test('denies staff without scoped access to assessment class group', async () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.GRADE_READ]),
        scopeGrants: [{
          permission: Permission.GRADE_READ,
          scopeType: 'class_group',
          scopeEntityIds: ['class-2'],
        }],
        scopeIdsByPermission: { [Permission.GRADE_READ]: 'class-2' },
        isElevated: false,
      },
    })
    await expectForbidden(checkAssessmentAccess(actor, ['assessment-1'], assessmentRepos()))
  })
})

describe('checkReportCardResultAccess', () => {
  test('loads results and delegates to compose', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    await checkReportCardResultAccess(actor, ['result-1'], assessmentRepos())
  })

  test('no-ops when no results are found', async () => {
    const repos = {
      ...assessmentRepos(),
      results: { findByIds: mock(async () => []) },
    } as unknown as AuthorizationRepositories
    await checkReportCardResultAccess(
      AuthFixtures.guardian.linkedTo('student-1'),
      ['missing'],
      repos,
    )
  })
})

describe('authorizeReportCardResultSave', () => {
  function reportCard(overrides: Partial<ReportCardResult> = {}): ReportCardResult {
    return {
      id: 'rcr-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      reportCardDefinitionId: 'rcd-1',
      periodId: 'period-1',
      attendanceSummary: { present: 1, absent: 0, late: 0, excused: 0 },
      assessmentResultCount: 0,
      status: ReportCardResultStatus.Draft,
      generatedAt: new Date('2026-09-01T00:00:00Z'),
      sectionResults: [],
      ...overrides,
    } as ReportCardResult
  }

  test('allows staff create without existing entity', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_READ])
    await authorizeReportCardResultSave(
      actor,
      reportCard(),
      undefined,
      enrollmentRepos('class-1'),
    )
  })

  test('denies teacher create without existing entity', async () => {
    const actor = AuthFixtures.teacher.homeroom('class-1')
    await expectForbidden(authorizeReportCardResultSave(
      actor,
      reportCard(),
      undefined,
      enrollmentRepos('class-1'),
    ))
  })

  test('denies guardian update of existing report card', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    const existing = reportCard()
    await expectForbidden(authorizeReportCardResultSave(
      actor,
      existing,
      existing,
      enrollmentRepos('class-1'),
    ))
  })
})
