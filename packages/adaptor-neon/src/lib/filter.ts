import type { Filter } from '@edaya/core'
import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, not, notInArray, or, sql } from 'drizzle-orm'

function buildFieldConditions(column: any, fieldFilter: any): any[] {
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
        if (Array.isArray(val)) {
          conditions.push(val.length === 0 ? sql`false` : inArray(column as never, val))
        }
        break
      case '$nin':
        if (Array.isArray(val) && val.length > 0) {
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
        break
    }
  }
  return conditions
}

function buildLogicalConditions(table: any, filter: any): any[] {
  const conditions: any[] = []

  if (filter.$and && Array.isArray(filter.$and)) {
    const sub = filter.$and.map((f: any) => buildWhereClause(table, f)).filter(Boolean)
    if (sub.length > 0) {
      conditions.push(and(...sub))
    }
  }
  if (filter.$or && Array.isArray(filter.$or)) {
    const sub = filter.$or.map((f: any) => buildWhereClause(table, f)).filter(Boolean)
    if (sub.length > 0) {
      conditions.push(or(...sub))
    }
  }
  if (filter.$not) {
    const sub = buildWhereClause(table, filter.$not)
    if (sub) {
      conditions.push(not(sub))
    }
  }

  return conditions
}

export function buildWhereClause<T>(table: any, filter: Filter<T> | undefined): any {
  if (!filter) {
    return undefined
  }

  const conditions: any[] = [...buildLogicalConditions(table, filter)]

  for (const key of Object.keys(filter)) {
    if (key.startsWith('$')) {
      continue
    }

    const column = table[key]
    if (!column) {
      continue
    }

    conditions.push(...buildFieldConditions(column, (filter as any)[key]))
  }

  if (conditions.length === 0) {
    return undefined
  }
  if (conditions.length === 1) {
    return conditions[0]
  }
  return and(...conditions)
}
