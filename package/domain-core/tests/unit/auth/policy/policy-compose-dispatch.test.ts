import { describe, expect, test } from 'bun:test'
import { AuthorizationError, createSystemActorMetadata, Permission } from '../../../../src/capabilities/authorization'
import {
  dispatchClassGroupAccess,
  dispatchReportCardResultAccess,
  dispatchStudentAccess,
} from '../../../../src/capabilities/authorization/policy/compose'
import { ReportCardResultStatus } from '../../../../src/domain/assessments/report-card-result'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { enrollmentRepos } from '../../../support/policy-fixtures'

describe('policy compose dispatch', () => {
  const systemActor = createSystemActorMetadata({
    schoolId: 'school-1',
    systemId: 'test-system',
    requestId: 'test',
    reason: 'unit-test',
  })

  const reportCard = {
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
  } as never

  test('allows system actor for student class group and report card dispatch', async () => {
    await dispatchStudentAccess(systemActor, ['student-1'], enrollmentRepos('class-1'))
    await dispatchClassGroupAccess(systemActor, ['class-1'], enrollmentRepos('class-1'))
    await dispatchReportCardResultAccess(systemActor, [reportCard], enrollmentRepos('class-1'))
  })

  test('routes guardian student and report card access through portal strategies', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    await dispatchStudentAccess(actor, ['student-1'], enrollmentRepos('class-1'))
    await dispatchClassGroupAccess(actor, ['class-1'], enrollmentRepos('class-1'))
    await dispatchReportCardResultAccess(actor, [reportCard], enrollmentRepos('class-1'))
  })

  test('routes staff student class group and report card access', async () => {
    const actor = AuthFixtures.staff.withPermissions([
      Permission.STUDENT_READ,
      Permission.ACADEMIC_PROGRAM_READ,
    ])
    await dispatchStudentAccess(actor, ['student-1'], enrollmentRepos('class-1'))
    await dispatchClassGroupAccess(actor, ['class-1'], enrollmentRepos('class-1'))
    await dispatchReportCardResultAccess(actor, [reportCard], enrollmentRepos('class-1'))
  })

  test('routes teacher and student portal actors through their strategies', async () => {
    const teacher = AuthFixtures.teacher.homeroom('class-1')
    await dispatchClassGroupAccess(teacher, ['class-1'], enrollmentRepos('class-1'))
    await dispatchReportCardResultAccess(teacher, [reportCard], enrollmentRepos('class-1'))

    const student = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    await dispatchStudentAccess(student, ['student-1'], enrollmentRepos('class-1'))
    await dispatchClassGroupAccess(student, ['class-1'], enrollmentRepos('class-1'))
    await dispatchReportCardResultAccess(student, [reportCard], enrollmentRepos('class-1'))
  })

  test('deduplicates student and class group ids before strategy dispatch', async () => {
    await dispatchStudentAccess(systemActor, ['student-1', 'student-1'], enrollmentRepos('class-1'))
    await dispatchClassGroupAccess(systemActor, ['class-1', 'class-1'], enrollmentRepos('class-1'))
  })

  test('rejects unsupported actor kinds at compose dispatch boundary', async () => {
    const invalidActor = { kind: 'bot', schoolId: 'school-1' } as never
    await expect(dispatchStudentAccess(invalidActor, ['student-1'], enrollmentRepos('class-1')))
      .rejects
      .toBeInstanceOf(AuthorizationError)
    await expect(dispatchClassGroupAccess(invalidActor, ['class-1'], enrollmentRepos('class-1')))
      .rejects
      .toBeInstanceOf(AuthorizationError)
    await expect(dispatchReportCardResultAccess(invalidActor, [reportCard], enrollmentRepos('class-1')))
      .rejects
      .toBeInstanceOf(AuthorizationError)
  })
})
