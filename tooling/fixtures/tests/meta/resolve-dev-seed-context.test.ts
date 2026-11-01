import { describe, expect, it } from 'bun:test'
import { resolveDevSeedContext } from '../../src/meta/resolve-dev-seed-context'

describe('resolveDevSeedContext', () => {
  it('returns the Abidjan collège dataset', () => {
    const context = resolveDevSeedContext()
    expect(context.datasetId).toBe('demo-ci')
    expect(context.schoolId).toBe('sch-edaya-ci-cocody')
    expect(context.minimalStaffEmail).toBe('a.kone@ecole-ci.edaya.dev')
    expect(context.dataset.entities.school?.city).toBe('Abidjan')
    expect(context.ownerStaffId).toBe('ci-st8')
  })
})
