import { afterEach, describe, expect, it } from 'bun:test'
import { resolveDevSeedContext, resolveDevSeedDatasetId } from '../../src/meta/resolve-dev-seed-context'

describe('resolveDevSeedContext', () => {
  const previous = process.env.SEED_DATASET

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.SEED_DATASET
    }
    else {
      process.env.SEED_DATASET = previous
    }
  })

  it('defaults to the local central bulk dataset', () => {
    delete process.env.SEED_DATASET
    expect(resolveDevSeedDatasetId()).toBe('central')
    expect(resolveDevSeedContext().schoolId).toBe('sch-edaya-central')
  })

  it('selects the Ivory Coast bulk dataset with central auth when requested', () => {
    process.env.SEED_DATASET = 'ci'
    const context = resolveDevSeedContext()
    expect(context.datasetId).toBe('ci')
    expect(context.schoolId).toBe('sch-edaya-central')
    expect(context.minimalStaffEmail).toBe('k.yann@school.edu')
    expect(context.staffAccounts.find(entry => entry.staffId === 'st8')?.email).toBe('k.yann@school.edu')
    expect(context.staffAccounts.find(entry => entry.staffId === 'st5')?.email).toBe('c.moreau@school.edu')
    expect(context.staffAccounts.find(entry => entry.staffId === 'st8')?.name).toContain('Yann')
    expect(context.dataset.entities.school?.city).toBe('Abidjan')
  })

  it('selects the legacy central bulk dataset when requested explicitly', () => {
    process.env.SEED_DATASET = 'central'
    const context = resolveDevSeedContext()
    expect(context.datasetId).toBe('central')
    expect(context.schoolId).toBe('sch-edaya-central')
    expect(context.minimalStaffEmail).toBe('k.yann@school.edu')
  })
})
