import type { SchoolRepositories } from '../../../src/ports'
import type { ActorMetadata } from '../../../src/services/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { SchoolQueryService } from '../../../src/services/queries/query-services'

describe('SchoolQueryService', () => {
  const mockRepos = {
    schools: { getOverdueFeeCount: mock(async () => 5), getPublishedReportCardCount: mock(async () => 10) },
    attendance: { findByStudentAndSession: mock(async () => ({ id: 'att1' })) },
    classSubjects: { findByClassAndSubject: mock(async () => ({ id: 'cs1' })) },
    classSubjectMatters: { findByClassSubjectAndSubjectMatter: mock(async () => ({ id: 'csm1' })) },
    classSubjectProgress: { findByClassSubjectMatterAndSession: mock(async () => ({ id: 'csp1' })) },
    gradeScales: { findDefaultBySchool: mock(async () => ({ id: 'gs1' })) },
    definitions: { findDefaultByGradeLevel: mock(async () => ({ id: 'def1' })) },
    results: { findByStudentAndPeriod: mock(async () => ({ id: 'rc1' })) },
    enrollments: { findActiveByStudent: mock(async () => ({ id: 'enr1' })) },
    guardianLinks: { findByGuardianAndStudent: mock(async () => ({ id: 'gl1' })) },
  } as unknown as SchoolRepositories

  const mockPolicy = {
    requirePermission: mock(async () => {}),
  } as unknown as AuthorizationPolicy

  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'school1',
    requestId: 'req1',
    reason: 'test',
  }
  const context = { schoolId: 'school1' }
  const mockAtomic = { execute: mock(async (op: () => Promise<any>) => op()) }

  const service = new SchoolQueryService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: mockAtomic,
  })

  test('getOverdueFeeCount checks permission and delegates to repo', async () => {
    const result = await service.getOverdueFeeCount('sch1', context)
    expect(mockPolicy.requirePermission).toHaveBeenCalledWith(actor, { action: 'query.get_overdue_fees', resource: context })
    expect(mockRepos.schools.getOverdueFeeCount).toHaveBeenCalledWith('sch1')
    expect(result).toBe(5)
  })

  test('getPublishedReportCardCount checks permission and delegates to repo', async () => {
    const result = await service.getPublishedReportCardCount('sch1', context)
    expect(mockPolicy.requirePermission).toHaveBeenCalledWith(actor, { action: 'queries.read_report_card_detail', resource: context })
    expect(mockRepos.schools.getPublishedReportCardCount).toHaveBeenCalledWith('sch1')
    expect(result).toBe(10)
  })
})
