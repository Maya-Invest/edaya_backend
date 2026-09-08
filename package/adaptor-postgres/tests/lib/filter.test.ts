import { describe, expect, test } from 'bun:test'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { buildWhereClause } from '../../src/lib/filter'

const students = pgTable('students', {
  id: text('id').primaryKey(),
  schoolId: text('school_id'),
  status: text('status'),
  score: integer('score'),
})

describe('buildWhereClause', () => {
  test('returns undefined for empty or missing filters', () => {
    expect(buildWhereClause(students, undefined)).toBeUndefined()
    expect(buildWhereClause(students, {})).toBeUndefined()
  })

  test('builds equality and comparison operators', () => {
    expect(buildWhereClause(students, { schoolId: 'school-1' })).toBeDefined()
    expect(buildWhereClause(students, { score: { $gte: 10, $lt: 20 } })).toBeDefined()
    expect(buildWhereClause(students, { status: { $ne: 'inactive' } })).toBeDefined()
  })

  test('builds membership and existence operators', () => {
    expect(buildWhereClause(students, { id: { $in: ['s1', 's2'] } })).toBeDefined()
    expect(buildWhereClause(students, { id: { $in: [] } })).toBeDefined()
    expect(buildWhereClause(students, { status: { $nin: ['inactive'] } })).toBeDefined()
    expect(buildWhereClause(students, { score: { $exists: true } })).toBeDefined()
    expect(buildWhereClause(students, { score: { $exists: false } })).toBeDefined()
  })

  test('combines logical operators with field filters', () => {
    const clause = buildWhereClause(students, {
      $and: [{ schoolId: 'school-1' }, { status: 'active' }],
      $or: [{ score: { $gte: 90 } }, { status: 'honors' }],
      $not: { status: 'withdrawn' },
    })

    expect(clause).toBeDefined()
  })

  test('ignores unknown table fields', () => {
    expect(buildWhereClause(students, { unknownField: 'value' } as never)).toBeUndefined()
  })
})
