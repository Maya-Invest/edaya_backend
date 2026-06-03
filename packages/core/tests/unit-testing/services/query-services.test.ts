import type { ActorMetadata, AuthorizationPolicy } from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import { SchoolService } from '../../../src'
import { AuthorizationError } from '../../../src/authorization'
import { SchoolQueryService } from '../../../src/legacy_services/queries'

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
    checkGlobalAction: mock(async () => {}),
  } as unknown as AuthorizationPolicy

  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'school1',
    requestId: 'req1',
    reason: 'test',
  }
  const mockAtomic = { execute: mock(async (op: () => Promise<any>) => op()) }

  const service = new SchoolQueryService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: mockAtomic,
  })

  test('getOverdueFeeCount checks permission and delegates to repo', async () => {
    const result = await service.getOverdueFeeCount('sch1')
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'query.get_overdue_fees')
    expect(mockRepos.schools.getOverdueFeeCount).toHaveBeenCalledWith('sch1')
    expect(result).toBe(5)
  })

  test('getPublishedReportCardCount checks permission and delegates to repo', async () => {
    const result = await service.getPublishedReportCardCount('sch1')
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'queries.read_report_card_detail')
    expect(mockRepos.schools.getPublishedReportCardCount).toHaveBeenCalledWith('sch1')
    expect(result).toBe(10)
  })
})

describe('SchoolService query operations', () => {
  const mockRepos = {
    schools: { getOverdueFeeCount: mock(async () => 5), getPublishedReportCardCount: mock(async () => 10) },
  } as unknown as SchoolRepositories

  const mockPolicy = {
    checkGlobalAction: mock(async () => {}),
  } as unknown as AuthorizationPolicy

  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'school1',
    requestId: 'req1',
    reason: 'test',
  }
  const mockAtomic = { execute: mock(async (op: () => Promise<any>) => op()) }

  const service = new SchoolService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: mockAtomic,
  })

  test('getOverdueFeeCount checks permission and delegates to repo', async () => {
    const result = await service.getOverdueFeeCount('school1')
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'query.get_overdue_fees')
    expect(mockRepos.schools.getOverdueFeeCount).toHaveBeenCalledWith('school1')
    expect(result).toBe(5)
  })

  test('getPublishedReportCardCount checks permission and delegates to repo', async () => {
    const result = await service.getPublishedReportCardCount('school1')
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'queries.read_report_card_detail')
    expect(mockRepos.schools.getPublishedReportCardCount).toHaveBeenCalledWith('school1')
    expect(result).toBe(10)
  })

  test('aggregate queries reject cross-tenant school ids before repository access', async () => {
    await expect(service.getOverdueFeeCount('other-school')).rejects.toBeInstanceOf(AuthorizationError)
  })
})
