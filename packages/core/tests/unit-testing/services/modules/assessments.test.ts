import type { AtomicExecutionPort } from '../../../../src/ports/atomic-execution'
import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import type { ActorMetadata } from '../../../../src/services/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { AssessmentKind } from '../../../../src/entities/assessments/assessment'
import { DeadlineComplianceStatus } from '../../../../src/entities/assessments/assessment-result'
import { ReportCardDefinitionSectionKind } from '../../../../src/entities/assessments/report-card-definition-section'
import { ReportCardResultStatus } from '../../../../src/entities/assessments/report-card-result'
import { AssessmentsService } from '../../../../src/services/modules/assessments'

describe('AssessmentsService', () => {
  const mockRepos = {
    schools: { findById: mock(async () => ({ id: 'sch1' })) },
    academicYears: { findById: mock(async () => ({ id: 'ay1', schoolId: 'sch1' })) },
    academicPeriods: { findById: mock(async () => ({ id: 'per1', schoolId: 'sch1', academicYearId: 'ay1', startDate: new Date(), endDate: new Date() })) },
    gradeLevels: { findById: mock(async () => ({ id: 'gl1', schoolId: 'sch1' })) },
    gradeScales: { findDefaultBySchool: mock(async () => undefined), save: mock(async () => {}) },
    definitions: { findOne: mock(async () => ({ id: 'def1' })), findById: mock(async () => ({ id: 'def1', schoolId: 'sch1', academicYearId: 'ay1' })), save: mock(async () => {}) },
    sections: { findById: mock(async () => undefined), list: mock(async () => [
      { id: 'sec_root', name: 'Root', kind: ReportCardDefinitionSectionKind.Group, order: 1, weight: 1 },
      { id: 'sec_subj', name: 'Math', kind: ReportCardDefinitionSectionKind.Subject, order: 1, weight: 1, parentSectionId: 'sec_root', subjectId: 'subj_math' },
    ]), save: mock(async () => {}) },
    classGroups: { findById: mock(async () => ({ id: 'cg1', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl1' })) },
    classSubjects: { findById: mock(async () => ({ id: 'cs1', classGroupId: 'cg1' })), list: mock(async () => [
      { id: 'cs1', classGroupId: 'cg1', subjectId: 'subj_math' },
    ]) },
    sessions: { findById: mock(async () => undefined) },
    assessments: { findById: mock(async id => ({ id, classGroupId: 'cg1', classSubjectId: 'cs1', periodId: 'per1', title: 'Test', kind: AssessmentKind.Quiz, dueAt: new Date(), maxScore: 100, coefficient: 1 })), save: mock(async () => {}), list: mock(async () => []) },
    assessmentResults: { list: mock(async ({ assessmentId }: any = {}) => assessmentId === 'ass_empty' ? [] : [{ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 80 }]), save: mock(async () => {}) },
    students: { findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1' })) },
    enrollments: { list: mock(async () => [{ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', status: 'Active' }]) },
    results: { findOne: mock(async () => undefined), save: mock(async () => {}) },
    attendance: { list: mock(async () => []) },
  } as unknown as SchoolRepositories

  const mockPolicy = { requirePermission: mock(async () => {}) } as unknown as AuthorizationPolicy
  const mockAtomic: AtomicExecutionPort = { execute: mock(async (op: () => Promise<any>) => op()) }
  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'sch1',
    requestId: 'req1',
    reason: 'test',
  }

  const service = new AssessmentsService({ repositories: mockRepos, authorizationPolicy: mockPolicy, actor, atomicExecution: mockAtomic })

  test('createGradeScale creates a grade scale', async () => {
    const res = await service.createGradeScale({ id: 'gs1', schoolId: 'sch1', name: 'Standard', minScore: 0, maxScore: 100, ranges: [{ letter: 'A', minScore: 90, maxScore: 100, isPassing: true }] })
    expect(res.id).toBe('gs1')
  })

  test('createReportCardDefinition creates a definition', async () => {
    const res = await service.createReportCardDefinition({ id: 'def1', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl1', name: 'Test' })
    expect(res.id).toBe('def1')
  })

  test('createAssessment creates an assessment', async () => {
    const res = await service.createAssessment({ id: 'ass1', classGroupId: 'cg1', classSubjectId: 'cs1', periodId: 'per1', title: 'Test', kind: AssessmentKind.Quiz, dueAt: new Date(), maxScore: 100 })
    expect(res.id).toBe('ass1')
  })

  test('completeAssessment marks assessment completed', async () => {
    const res = await service.completeAssessment({ assessmentId: 'ass_empty' })
    expect(res.metAt).toBeDefined()
  })

  test('recordAssessmentResult records score', async () => {
    const res = await service.recordAssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 95 })
    expect(res.score).toBe(95)
  })

  test('recordAssessmentResultCompliance records compliance', async () => {
    const res = await service.recordAssessmentResultCompliance({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', status: DeadlineComplianceStatus.Met })
    expect(res.status).toBe(DeadlineComplianceStatus.Met)
  })

  test('createReportCardDefinitionSection creates a section', async () => {
    mockRepos.sections.findById = mock(async () => ({ id: 'sec_root', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Group })) as any
    const res = await service.createReportCardDefinitionSection({ id: 'sec1', reportCardDefinitionId: 'def1', kind: ReportCardDefinitionSectionKind.Group, name: 'Main', order: 1, weight: 1, parentSectionId: 'sec_root' })
    expect(res.id).toBe('sec1')
  })

  test('generateReportCardResult generates report card', async () => {
    const res = await service.generateReportCardResult({ id: 'rc1', studentId: 'stu1', periodId: 'per1', reportCardDefinitionId: 'def1' })
    expect(res.id).toBe('rc1')
  })

  test('publishReportCardResult publishes report card', async () => {
    const res = await service.publishReportCardResult({ id: 'rc1', studentId: 'stu1', periodId: 'per1', reportCardDefinitionId: 'def1' })
    expect(res.status).toBe(ReportCardResultStatus.Published)
  })
})
