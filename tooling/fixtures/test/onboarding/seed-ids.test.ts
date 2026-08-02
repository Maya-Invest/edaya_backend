import { describe, expect, it } from 'bun:test'
import {
  structureClassGroupSeedId,
  structureGradeLevelSeedId,
} from '../../src/onboarding/seed-ids'

describe('structure seed ids', () => {
  it('maps college and lycee template ids to demo seed nomenclature', () => {
    expect(structureGradeLevelSeedId('ci-college:6EME')).toBe('gl-6')
    expect(structureGradeLevelSeedId('ci-college:3EME')).toBe('gl-3')
    expect(structureGradeLevelSeedId('ci-lycee:2NDA')).toBe('gl-2nda')
    expect(structureGradeLevelSeedId('ci-lycee:2NDC')).toBe('gl-2')
    expect(structureGradeLevelSeedId('ci-lycee:1ERA')).toBe('gl-1era')
    expect(structureGradeLevelSeedId('ci-lycee:1ERD')).toBe('gl-1erd')
    expect(structureGradeLevelSeedId('ci-lycee:TLEA')).toBe('gl-tlea')
    expect(structureGradeLevelSeedId('ci-lycee:TLEC')).toBe('gl-t')
    expect(structureGradeLevelSeedId('ci-lycee:TLED')).toBe('gl-tled')
  })

  it('falls back to gl-{levelCode} for other templates', () => {
    expect(structureGradeLevelSeedId('ci-primaire:CP1')).toBe('gl-cp1')
  })

  it('builds class group ids like the demo seed', () => {
    expect(structureClassGroupSeedId('gl-6', 0)).toBe('6a')
    expect(structureClassGroupSeedId('gl-6', 1)).toBe('6b')
    expect(structureClassGroupSeedId('gl-4', 0)).toBe('4a')
    expect(structureClassGroupSeedId('gl-t', 0)).toBe('ta')
    expect(structureClassGroupSeedId('gl-cp1', 0)).toBe('cp1a')
  })
})
