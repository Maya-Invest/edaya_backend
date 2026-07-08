import type {
  GuardianActorMetadata,
  StaffActorMetadata,
  StudentActorMetadata,
  TeacherActorMetadata,
} from '../../../../src/capabilities/authorization'
import type { ReportCardResult } from '../../../../src/domain/assessments/report-card-result'
import type { SchoolRepositories } from '../../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import { AuthorizationError, Permission } from '../../../../src/capabilities/authorization'
import {
  authorizeReportCardCommentSave,
  guardianReportCardResultAccess,
  staffReportCardResultAccess,
  studentSelfReportCardResultAccess,
  teacherReportCardResultAccess,
} from '../../../../src/capabilities/authorization/policy/strategies/report-card-access'
import { ReportCardResultStatus } from '../../../../src/domain/assessments/report-card-result'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { enrollmentRepos } from '../../../support/policy-fixtures'

function reportCardResult(overrides: Partial<ReportCardResult> & Pick<ReportCardResult, 'studentId' | 'classGroupId'>): ReportCardResult {
  return {
    id: 'rcr-1',
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

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('report card result access strategies', () => {
  test('allows guardian linked to report card student', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await guardianReportCardResultAccess(actor as GuardianActorMetadata, [reportCardResult({
      studentId: 'student-1',
      classGroupId: 'class-1',
    })], enrollmentRepos('class-1'))
  })

  test('denies guardian for unlinked student report card', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await expectForbidden(guardianReportCardResultAccess(actor as GuardianActorMetadata, [reportCardResult({
      studentId: 'student-2',
      classGroupId: 'class-1',
    })], enrollmentRepos('class-1')))
  })

  test('allows student self report card access', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    await studentSelfReportCardResultAccess(actor as StudentActorMetadata, [reportCardResult({
      studentId: 'student-1',
      classGroupId: 'class-1',
    })], enrollmentRepos('class-1'))
  })

  test('allows homeroom teacher to read class report cards', async () => {
    const actor = AuthFixtures.teacher.homeroom('class-1')
    await teacherReportCardResultAccess(actor as TeacherActorMetadata, [reportCardResult({
      studentId: 'student-1',
      classGroupId: 'class-1',
    })], enrollmentRepos('class-1'))
  })

  test('allows subject teacher to read class report cards when section results are empty', async () => {
    const actor = AuthFixtures.teacher.subject('cs-math', [])
    const repos = {
      classSubjects: {
        list: mock(async () => [{ id: 'cs-math', classGroupId: 'class-1' }]),
      },
    } as unknown as SchoolRepositories

    await teacherReportCardResultAccess(actor as TeacherActorMetadata, [reportCardResult({
      studentId: 'student-1',
      classGroupId: 'class-1',
    })], repos)
  })

  test('allows staff with student read to access report cards', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_READ])
    await staffReportCardResultAccess(actor as StaffActorMetadata, [reportCardResult({
      studentId: 'student-1',
      classGroupId: 'class-1',
    })], enrollmentRepos('class-1'))
  })
})

describe('authorizeReportCardCommentSave', () => {
  test('allows teacher comment save when homeroom scope matches', async () => {
    const actor = AuthFixtures.teacher.homeroom('class-1')
    const before = reportCardResult({
      studentId: 'student-1',
      classGroupId: 'class-1',
      teacherComment: 'Before',
    })
    const after = reportCardResult({
      studentId: 'student-1',
      classGroupId: 'class-1',
      teacherComment: 'After',
    })

    await authorizeReportCardCommentSave(actor as TeacherActorMetadata, before, after, {} as SchoolRepositories)
  })

  test('delegates staff comment save to staff report card access', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_READ])
    const result = reportCardResult({
      studentId: 'student-1',
      classGroupId: 'class-1',
      principalComment: 'Updated',
    })

    await authorizeReportCardCommentSave(actor as StaffActorMetadata, result, result, enrollmentRepos('class-1'))
  })
})
