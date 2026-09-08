import { describe, expect, test } from 'bun:test'
import { createDefaultMappers, deserializeJsonb, rowToConstructorArgs } from '../../src/lib/mappers'

class SampleEntity {
  readonly data: { id: string, name?: string, count?: number }

  constructor(args: { id: string, name?: string, count?: number }) {
    this.data = args
  }

  get id() {
    return this.data.id
  }
}

describe('rowToConstructorArgs', () => {
  test('maps null database values to undefined constructor args', () => {
    expect(rowToConstructorArgs({ id: 'e1', name: null, count: 3 })).toEqual({
      id: 'e1',
      name: undefined,
      count: 3,
    })
  })
})

describe('deserializeJsonb', () => {
  test('returns null and undefined unchanged', () => {
    expect(deserializeJsonb(null)).toBeNull()
    expect(deserializeJsonb(undefined)).toBeUndefined()
  })

  test('revives ISO date strings inside nested JSON payloads', () => {
    const value = deserializeJsonb({
      startsAt: '2026-03-01T09:00:00.000Z',
      nested: { updatedAt: '2026-03-02T10:15:30+00:00' },
      label: 'not-a-date',
    })

    expect(value.startsAt).toBeInstanceOf(Date)
    expect(value.nested.updatedAt).toBeInstanceOf(Date)
    expect(value.label).toBe('not-a-date')
  })
})

describe('createDefaultMappers', () => {
  test('round-trips entity data through row serialization', () => {
    const { toRow, toDomain } = createDefaultMappers(SampleEntity)
    const entity = new SampleEntity({ id: 'e1', name: 'Alpha', count: 2 })

    expect(toRow(entity)).toEqual({ id: 'e1', name: 'Alpha', count: 2 })

    const restored = toDomain({ id: 'e1', name: null, count: 5 })
    expect(restored).toBeInstanceOf(SampleEntity)
    expect(restored.id).toBe('e1')
    expect(restored.data.name).toBeUndefined()
    expect(restored.data.count).toBe(5)
  })
})
