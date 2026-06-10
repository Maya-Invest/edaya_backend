import { describe, expect, test } from 'bun:test'
import { Permission } from '../../../src/authorization'
import { parseDomain } from '../../../src/domains/utils'
import { scopeGrantSchema } from '../../../src/value_object/scope-grant'

describe('scopeGrant value object', () => {
  test('parses a valid scope grant', () => {
    const grant = parseDomain(scopeGrantSchema, {
      permission: Permission.PAYMENT_READ,
      scopeType: 'student',
      scopeEntityIds: ['student-1'],
    })
    expect(grant.permission).toBe(Permission.PAYMENT_READ)
    expect(grant.scopeEntityIds).toEqual(['student-1'])
  })
})
