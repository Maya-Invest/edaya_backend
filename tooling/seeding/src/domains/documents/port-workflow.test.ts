import type { DocumentsSeedPort } from './port'
import { demoCiDataset } from '@edaya/fixtures'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { describe, expect, test } from 'bun:test'
import { seedDevDocuments } from './workflow'

describe('documents seed port workflow', () => {
  test('requests ready issuances and persists failed rows', async () => {
    const calls = { requestIssuance: 0, saveFailedIssuance: 0, dispatchRender: 0 }
    const port: DocumentsSeedPort = {
      requestIssuance: async () => { calls.requestIssuance += 1 },
      saveFailedIssuance: async () => { calls.saveFailedIssuance += 1 },
      dispatchRender: async () => { calls.dispatchRender += 1 },
    }
    const counts = await seedDevDocuments(port, demoCiDataset)
    expect(counts.documentIssuances).toBe(resolveExpectedCounts(demoCiDataset)['document-issuances'] ?? 0)
    expect(calls.requestIssuance).toBe(2)
    expect(calls.saveFailedIssuance).toBe(1)
    expect(calls.dispatchRender).toBe(1)
  })
})
