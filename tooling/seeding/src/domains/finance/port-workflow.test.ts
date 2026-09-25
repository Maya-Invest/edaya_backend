import type { FinanceSeedPort } from './port'
import { demoCiDataset } from '@edaya/fixtures'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { describe, expect, test } from 'bun:test'
import { seedDevFinance } from './workflow'

describe('finance seed port workflow', () => {
  test('seeds catalog services, enrollments, and payments', async () => {
    const calls = {
      createCatalogService: 0,
      enrollStudentInService: 0,
      recordPayment: 0,
      waiveStudentCharge: 0,
      cancelStudentCharge: 0,
      reverseAllocation: 0,
      reversePayment: 0,
      refundAvailableBalance: 0,
    }
    const port: FinanceSeedPort = {
      createCatalogService: async () => { calls.createCatalogService += 1 },
      enrollStudentInService: async () => { calls.enrollStudentInService += 1 },
      recordPayment: async () => { calls.recordPayment += 1 },
      waiveStudentCharge: async () => { calls.waiveStudentCharge += 1 },
      cancelStudentCharge: async () => { calls.cancelStudentCharge += 1 },
      listPaymentAllocations: async () => [
        { id: 'alloc-ci-enr-60', chargeId: 'ci-enr-60', causedByPaymentId: 'ci-pay-120', kind: 'settle' },
      ],
      reverseAllocation: async () => { calls.reverseAllocation += 1 },
      reversePayment: async () => { calls.reversePayment += 1 },
      refundAvailableBalance: async () => { calls.refundAvailableBalance += 1 },
    }

    const counts = await seedDevFinance(port, demoCiDataset)
    const expected = resolveExpectedCounts(demoCiDataset)
    const refunds = (demoCiDataset.entities.payments ?? []).filter(payment => 'refund' in payment).length

    expect(counts).toEqual({
      catalogServices: expected['catalog-services'] ?? 0,
      studentServiceEnrollments: expected['student-service-enrollments'] ?? 0,
      payments: (expected.payments ?? 0) + refunds,
    })
    expect(calls.createCatalogService).toBe(expected['catalog-services'] ?? 0)
    expect(calls.enrollStudentInService).toBe(expected['student-service-enrollments'] ?? 0)
    expect(calls.recordPayment).toBe(expected.payments ?? 0)
    expect(calls.waiveStudentCharge).toBeGreaterThan(0)
    expect(calls.cancelStudentCharge).toBeGreaterThan(0)
    expect(calls.reverseAllocation).toBeGreaterThan(0)
    expect(calls.reversePayment).toBeGreaterThan(0)
    expect(calls.refundAvailableBalance).toBe(refunds)
  })
})
