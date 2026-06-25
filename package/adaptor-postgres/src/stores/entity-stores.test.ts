import { CORE_ENTITY_KEYS } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createEntityStores } from './entity-stores'

const SPECIALIZED_ENTITY_STORE_KEYS = [
  'accessRoles',
  'accountInvitations',
  'schoolNotificationTemplates',
  'staffRoleAssignments',
] as const

function keyDifference(actual: readonly string[], expected: readonly string[]) {
  const actualKeys = new Set(actual)
  const expectedKeys = new Set(expected)
  return {
    missing: expected.filter(key => !actualKeys.has(key)),
    extra: actual.filter(key => !expectedKeys.has(key)),
  }
}

describe('Postgres entity stores', () => {
  test('cover every core entity with a generic or documented specialized store', () => {
    const genericStoreKeys = Object.keys(createEntityStores({}))
      .map(key => key === 'schoolsStore' ? 'schools' : key)
    const adapterStoreKeys = [
      ...genericStoreKeys,
      ...SPECIALIZED_ENTITY_STORE_KEYS,
    ]

    expect(keyDifference(adapterStoreKeys, CORE_ENTITY_KEYS)).toEqual({
      missing: [],
      extra: [],
    })
    expect(new Set(adapterStoreKeys).size).toBe(adapterStoreKeys.length)
  })
})
