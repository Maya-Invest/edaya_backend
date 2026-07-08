import { buildSeedValidationTargets } from '@edaya/fixtures/meta/validation-harness'
import { CORE_ENTITY_KEYS } from '@edaya/school-service'
import { describe, expect, test } from 'bun:test'
import { clientBindings } from '../../generated/api-client'
import { isSeedEntityKey, seedCommandPublicName, seedEntityPublicName } from './catalog'

function keyDifference(actual: readonly string[], expected: readonly string[]) {
  const actualKeys = new Set(actual)
  const expectedKeys = new Set(expected)
  return {
    missing: expected.filter(key => !actualKeys.has(key)),
    extra: actual.filter(key => !expectedKeys.has(key)),
  }
}

describe('HTTP seed catalog', () => {
  test('uses generated entity and command public names', () => {
    expect(seedEntityPublicName('assessments')).toBe('assessments')
    expect(seedCommandPublicName('recordAssessmentResult')).toBe('record-assessment-result')
  })

  test('generated public names are unique within each catalog', () => {
    const entityNames = Object.values(clientBindings.entities).map(binding => binding.publicName)
    const commandNames = Object.values(clientBindings.commands).map(binding => binding.publicName)

    expect(new Set(entityNames).size).toBe(entityNames.length)
    expect(new Set(commandNames).size).toBe(commandNames.length)
  })

  test('generated entities cover every seed validation target', () => {
    const missing = buildSeedValidationTargets()
      .map(target => target.serviceName)
      .filter(serviceName => !isSeedEntityKey(serviceName))

    expect(missing).toEqual([])
  })

  test('generated bindings cover every core entity exactly once', () => {
    const generatedKeys = Object.keys(clientBindings.entities)

    expect(keyDifference(generatedKeys, CORE_ENTITY_KEYS)).toEqual({
      missing: [],
      extra: [],
    })
    expect(new Set(generatedKeys).size).toBe(generatedKeys.length)
  })
})
