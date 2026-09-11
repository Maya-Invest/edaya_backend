import type { Filter } from '@edaya/core'
import { DomainValidationError } from '@edaya/core'
import { and, eq, getTableColumns, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, not, notInArray, or, sql } from 'drizzle-orm'

function buildFieldConditions(column: any, fieldFilter: any): any[] {
  if (fieldFilter === null)
    return [isNull(column)]
  if (
    !fieldFilter
    || typeof fieldFilter !== 'object'
    || fieldFilter instanceof Date
    || Array.isArray(fieldFilter)
  ) {
    return [eq(column as never, fieldFilter)]
  }

  const conditions: any[] = []
  for (const op of Object.keys(fieldFilter)) {
    const val = fieldFilter[op]
    switch (op) {
      case '$eq':
        conditions.push(eq(column as never, val))
        break
      case '$ne':
        conditions.push(ne(column as never, val))
        break
      case '$gt':
        conditions.push(gt(column as never, val))
        break
      case '$gte':
        conditions.push(gte(column as never, val))
        break
      case '$lt':
        conditions.push(lt(column as never, val))
        break
      case '$lte':
        conditions.push(lte(column as never, val))
        break
      case '$in':
        if (!Array.isArray(val))
          throw new DomainValidationError('$in requires an array')
        conditions.push(val.length === 0 ? sql`false` : inArray(column as never, val))
        break
      case '$nin':
        if (!Array.isArray(val))
          throw new DomainValidationError('$nin requires an array')
        if (val.length > 0) {
          conditions.push(notInArray(column as never, val))
        }
        break
      case '$exists':
        if (val === true) {
          conditions.push(isNotNull(column as never))
        }
        else if (val === false) {
          conditions.push(isNull(column as never))
        }
        else {
          throw new DomainValidationError('$exists requires a boolean')
        }
        break
      default:
        throw new DomainValidationError(`Unsupported filter operator: ${op}`)
    }
  }
  return conditions
}

function buildLogicalConditions(table: any, filter: any, depth: number): any[] {
  const conditions: any[] = []

  if (filter.$and !== undefined) {
    if (!Array.isArray(filter.$and))
      throw new DomainValidationError('$and requires an array')
    const sub = filter.$and.map((f: any) => buildWhereClause(table, f, depth + 1) ?? sql`true`)
    if (sub.length > 0) {
      conditions.push(and(...sub))
    }
  }
  if (filter.$or !== undefined) {
    if (!Array.isArray(filter.$or))
      throw new DomainValidationError('$or requires an array')
    const sub = filter.$or.map((f: any) => buildWhereClause(table, f, depth + 1) ?? sql`true`)
    conditions.push(sub.length ? or(...sub) : sql`false`)
  }
  if (filter.$not !== undefined) {
    const sub = buildWhereClause(table, filter.$not, depth + 1)
    conditions.push(not(sub ?? sql`true`))
  }

  return conditions
}

export function buildWhereClause<T>(table: any, filter: Filter<T> | undefined, depth = 0): any {
  if (filter === undefined) {
    return undefined
  }
  if (!filter || typeof filter !== 'object' || Array.isArray(filter) || depth > 16)
    throw new DomainValidationError('Filter must be an object with at most 16 nested levels')

  const conditions: any[] = [...buildLogicalConditions(table, filter, depth)]

  for (const key of Object.keys(filter)) {
    if (key.startsWith('$')) {
      if (!['$and', '$or', '$not', '$orderBy', '$limit', '$offset'].includes(key))
        throw new DomainValidationError(`Unsupported query option: ${key}`)
      continue
    }

    const columns = getTableColumns(table)
    const column = Object.hasOwn(columns, key) ? columns[key] : undefined
    if (!column) {
      throw new DomainValidationError(`Unknown filter field: ${key}`)
    }

    conditions.push(...buildFieldConditions(column, (filter as Record<string, unknown>)[key]))
  }

  if (conditions.length === 0) {
    return undefined
  }
  if (conditions.length === 1) {
    return conditions[0]
  }
  return and(...conditions)
}
