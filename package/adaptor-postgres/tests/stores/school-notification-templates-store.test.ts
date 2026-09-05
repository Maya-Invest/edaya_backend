import { describe, expect, test } from 'bun:test'
import { buildWhereClause } from '../../src/lib/filter'
import * as schema from '../../src/postgres-schema'
import { normalizeSchoolNotificationTemplatesQuery } from '../../src/stores/school-notification-templates-store'

describe('PostgresSchoolNotificationTemplatesStore query normalization', () => {
  test('maps schoolId filter to id for postgres where clause', () => {
    const normalized = normalizeSchoolNotificationTemplatesQuery({ schoolId: 'school-a' })

    expect(normalized).toEqual({ id: 'school-a' })

    const whereClause = buildWhereClause(schema.schoolNotificationTemplates, normalized)
    expect(whereClause).toBeDefined()
  })

  test('preserves unrelated query options when mapping schoolId', () => {
    const normalized = normalizeSchoolNotificationTemplatesQuery({
      schoolId: 'school-a',
      $limit: 1,
      $offset: 0,
    })

    expect(normalized).toEqual({
      id: 'school-a',
      $limit: 1,
      $offset: 0,
    })
  })

  test('leaves queries without schoolId unchanged', () => {
    const options = { id: 'school-a', $limit: 5 }
    expect(normalizeSchoolNotificationTemplatesQuery(options)).toEqual(options)
  })
})
