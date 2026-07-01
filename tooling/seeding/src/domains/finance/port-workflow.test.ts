import type { FinanceSeedPort } from './port'
import { demoDataset } from '@edaya/fixtures'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { describe, expect, test } from 'bun:test'
import { seedDevFinance } from './workflow'

describe('finance seed port workflow', () => {
  test('seeds fees, student fee assignments, and payments', async () => {
    const port: FinanceSeedPort = {
      createFee: async () => {},
      assignFeeToStudent: async () => {},
      recordPayment: async () => {},
    }

    const counts = await seedDevFinance(port, demoDataset)
    const expected = resolveExpectedCounts(demoDataset)

    expect(counts).toEqual({
      fees: expected.fees ?? 0,
      studentFees: expected['student-fees'] ?? 0,
      payments: expected.payments ?? 0,
    })
  })
})
