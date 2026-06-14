import type { AuthorizationPolicy } from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import { SchoolService } from '../../../src'
import { AuthorizationError } from '../../../src/authorization'
import { createElevatedTestStaffActor } from '../../support/elevated-test-actor'

describe('SchoolService query operations', () => {
  const mockRepos = {
    schools: { getOverdueFeeCount: mock(async () => 5), getPublishedReportCardCount: mock(async () => 10) },
  } as unknown as SchoolRepositories

  const mockPolicy = {
  } as unknown as AuthorizationPolicy

  const actor = createElevatedTestStaffActor('school1', 'staff-test')
  const mockAtomic = { execute: mock(async (op: () => Promise<any>) => op()) }

  const service = new SchoolService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: mockAtomic,
  })

  test('getOverdueFeeCount checks permission and delegates to repo', async () => {
    const result = await service.getOverdueFeeCount('school1')
    expect(mockRepos.schools.getOverdueFeeCount).toHaveBeenCalledWith('school1')
    expect(result).toBe(5)
  })

  test('getPublishedReportCardCount checks permission and delegates to repo', async () => {
    const result = await service.getPublishedReportCardCount('school1')
    expect(mockRepos.schools.getPublishedReportCardCount).toHaveBeenCalledWith('school1')
    expect(result).toBe(10)
  })

  test('aggregate queries reject cross-tenant school ids before repository access', async () => {
    await expect(service.getOverdueFeeCount('other-school')).rejects.toBeInstanceOf(AuthorizationError)
  })
})
