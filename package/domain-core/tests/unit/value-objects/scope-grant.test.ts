import { parseDomain, Permission, scopeGrantSchema } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

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
