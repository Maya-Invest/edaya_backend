import type { AtomicExecutionPort } from '../../../../src/ports/atomic-execution'
import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import type { ActorMetadata } from '../../../../src/services/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { Fee, FeeCategory } from '../../../../src/entities/finances/fee'
import { FinanceService } from '../../../../src/services/commands/finance'

describe('FinanceService', () => {
  const mockRepos = {
    fees: {
      findById: mock(async id => new Fee({
        id,
        schoolId: 'sch1',
        academicYearId: 'ay1',
        name: 'Tuition',
        defaultAmount: 1000,
        currency: 'USD',
        category: FeeCategory.Tuition,
        installments: id === 'fee_inst'
          ? [
              { label: 'Inst 1', percentage: 50, dueDate: new Date() },
              { label: 'Inst 2', percentage: 50, dueDate: new Date() },
            ]
          : [],
      })),
      save: mock(async () => {}),
    },
    studentFees: { save: mock(async () => {}) },
    students: { findById: mock(async () => ({ id: 'stu1', schoolId: 'sch1' })) },
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

  const service = new FinanceService({ repositories: mockRepos, authorizationPolicy: mockPolicy, actor, atomicExecution: mockAtomic } as any)

  test('assignFeeToStudent generates installments', async () => {
    const res = await service.assignFeeToStudent({
      id: 'sf1',
      studentId: 'stu1',
      feeId: 'fee_inst',
    })
    expect(res.installments.length).toBe(2)
    expect(res.installments[0]?.expectedAmount).toBe(500)
    expect(res.installments[1]?.expectedAmount).toBe(500)
  })
})
