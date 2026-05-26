import { describe, expect, it } from 'bun:test'
import { matchesFilter } from './filter-matcher'

interface TestEntity {
  id: string
  name: string
  age: number
  role: string
  joinedAt: Date
  bio?: string
}

const entities: TestEntity[] = [
  { id: '1', name: 'Alice', age: 25, role: 'Admin', joinedAt: new Date('2026-01-01T00:00:00Z'), bio: 'Developer' },
  { id: '2', name: 'Bob', age: 30, role: 'Teacher', joinedAt: new Date('2026-02-01T00:00:00Z') },
  { id: '3', name: 'Charlie', age: 35, role: 'Student', joinedAt: new Date('2026-03-01T00:00:00Z'), bio: 'Math genius' },
]

const alice = entities[0]!
const bob = entities[1]!
const charlie = entities[2]!

describe('Mongo-style filtering utility', () => {
  it('should match implicit equality', () => {
    const filter = { name: 'Alice' }
    const result = entities.filter(e => matchesFilter(e, filter))
    expect(result).toEqual([alice])
  })

  it('should match multiple implicit equality fields', () => {
    const filter = { name: 'Alice', age: 25 }
    const result = entities.filter(e => matchesFilter(e, filter))
    expect(result).toEqual([alice])

    const filterMismatch = { name: 'Alice', age: 30 }
    const resultMismatch = entities.filter(e => matchesFilter(e, filterMismatch))
    expect(resultMismatch).toEqual([])
  })

  it('should support $eq and $ne operators', () => {
    expect(entities.filter(e => matchesFilter(e, { name: { $eq: 'Alice' } }))).toEqual([alice])
    expect(entities.filter(e => matchesFilter(e, { role: { $ne: 'Admin' } }))).toEqual([bob, charlie])
  })

  it('should support range comparisons ($gt, $gte, $lt, $lte)', () => {
    expect(entities.filter(e => matchesFilter(e, { age: { $gt: 30 } }))).toEqual([charlie])
    expect(entities.filter(e => matchesFilter(e, { age: { $gte: 30 } }))).toEqual([bob, charlie])
    expect(entities.filter(e => matchesFilter(e, { age: { $lt: 30 } }))).toEqual([alice])
    expect(entities.filter(e => matchesFilter(e, { age: { $lte: 30 } }))).toEqual([alice, bob])
  })

  it('should support $in and $nin operators', () => {
    expect(entities.filter(e => matchesFilter(e, { role: { $in: ['Admin', 'Teacher'] } }))).toEqual([alice, bob])
    expect(entities.filter(e => matchesFilter(e, { role: { $nin: ['Admin', 'Teacher'] } }))).toEqual([charlie])
  })

  it('should support $exists operator', () => {
    expect(entities.filter(e => matchesFilter(e, { bio: { $exists: true } }))).toEqual([alice, charlie])
    expect(entities.filter(e => matchesFilter(e, { bio: { $exists: false } }))).toEqual([bob])
  })

  it('should support Date comparisons correctly', () => {
    const targetDate = new Date('2026-02-01T00:00:00Z')
    expect(entities.filter(e => matchesFilter(e, { joinedAt: { $eq: targetDate } }))).toEqual([bob])
    expect(entities.filter(e => matchesFilter(e, { joinedAt: { $gt: targetDate } }))).toEqual([charlie])
    expect(entities.filter(e => matchesFilter(e, { joinedAt: { $lt: targetDate } }))).toEqual([alice])
  })

  it('should support logical $and operator', () => {
    const filter = {
      $and: [
        { age: { $gt: 20 } },
        { role: { $ne: 'Student' } },
      ],
    }
    expect(entities.filter(e => matchesFilter(e, filter))).toEqual([alice, bob])
  })

  it('should support logical $or operator', () => {
    const filter = {
      $or: [
        { name: 'Alice' },
        { role: 'Student' },
      ],
    }
    expect(entities.filter(e => matchesFilter(e, filter))).toEqual([alice, charlie])
  })

  it('should support logical $not operator', () => {
    const filter = {
      $not: { age: { $gte: 30 } },
    }
    expect(entities.filter(e => matchesFilter(e, filter))).toEqual([alice])
  })
})
