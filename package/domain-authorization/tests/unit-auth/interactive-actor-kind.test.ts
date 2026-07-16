import { describe, expect, test } from 'bun:test'
import { parseInteractiveActorKind } from '../../src/resolution/interactive-actor-kind'

describe('parseInteractiveActorKind', () => {
  test('parses known actor kinds case-insensitively', () => {
    expect(parseInteractiveActorKind('Staff')).toBe('staff')
    expect(parseInteractiveActorKind(' GUARDIAN ')).toBe('guardian')
    expect(parseInteractiveActorKind('student')).toBe('student')
    expect(parseInteractiveActorKind('TEACHER')).toBe('teacher')
  })

  test('returns undefined for unknown or empty values', () => {
    expect(parseInteractiveActorKind(undefined)).toBeUndefined()
    expect(parseInteractiveActorKind('')).toBeUndefined()
    expect(parseInteractiveActorKind('service')).toBeUndefined()
  })
})
