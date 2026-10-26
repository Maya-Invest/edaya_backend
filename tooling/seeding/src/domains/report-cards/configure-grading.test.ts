import { GradeScale, gradingPolicySchema } from '@edaya/core'
import { demoCiDataset } from '@edaya/fixtures'
import { expect, test } from 'bun:test'
import { configureSeedGrading } from './configure-grading'

const record = { gradeLevelId: 'ci-gl-4', academicYearId: 'year', scaleId: 'ci-gs-20', mode: 'numeric-first' as const, aggregateLabel: 'Moyenne générale' }
const policy = gradingPolicySchema.parse({ ...record, revision: 1, scale: new GradeScale(demoCiDataset.entities.gradeScales![0]!).data })

test('waits for completion and reuses an already configured seed policy', async () => {
  let current: typeof policy | undefined
  let configured = 0
  let advanced = 0
  const operations = {
    read: async () => current,
    configure: async () => {
      configured++
      current = policy
    },
    advance: async () => {
      advanced++
      current = { ...policy, status: 'completed' }
    },
  }
  await configureSeedGrading(record, operations)
  expect(configured).toBe(1)
  expect(advanced).toBe(1)
  await configureSeedGrading(record, operations)
  expect(configured).toBe(1)
  expect(advanced).toBe(1)
})

test('blocks seeding on failed, mismatched, or unfinished grading', async () => {
  const configure = async () => {
    throw new Error('Must not overwrite existing grading')
  }
  await expect(configureSeedGrading(record, { read: async () => ({ ...policy, status: 'failed' }), configure, advance: async () => {} })).rejects.toThrow('recalculation failed')
  await expect(configureSeedGrading(record, { read: async () => ({ ...policy, aggregateLabel: 'Different' }), configure, advance: async () => {} })).rejects.toThrow('differs')
  let advances = 0
  await expect(configureSeedGrading(record, {
    read: async () => policy,
    configure,
    advance: async () => {
      advances++
    },
  })).rejects.toThrow('Timed out')
  expect(advances).toBe(240)
})
