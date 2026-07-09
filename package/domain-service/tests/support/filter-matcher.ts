import type { Filter } from '@edaya/core'

function areEqual(a: any, b: any): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }
  return a === b
}

export function matchesFilter<T>(entity: T, filter?: Filter<T>): boolean {
  if (!filter) {
    return true
  }

  for (const key of Object.keys(filter)) {
    if (key === '$and') {
      const andFilters = filter.$and
      if (Array.isArray(andFilters)) {
        if (!andFilters.every(subFilter => matchesFilter(entity, subFilter))) {
          return false
        }
      }
      continue
    }

    if (key === '$or') {
      const orFilters = filter.$or
      if (Array.isArray(orFilters)) {
        if (!orFilters.some(subFilter => matchesFilter(entity, subFilter))) {
          return false
        }
      }
      continue
    }

    if (key === '$not') {
      const notFilter = filter.$not
      if (notFilter) {
        if (matchesFilter(entity, notFilter)) {
          return false
        }
      }
      continue
    }

    // Otherwise, we are filtering on an entity field
    const value = (entity as any)[key]
    const fieldFilter = (filter as any)[key]

    if (
      fieldFilter
      && typeof fieldFilter === 'object'
      && !Array.isArray(fieldFilter)
      && !(fieldFilter instanceof Date)
    ) {
      // It's a field-level query operator object
      for (const op of Object.keys(fieldFilter)) {
        const opVal = fieldFilter[op]
        switch (op) {
          case '$eq':
            if (!areEqual(value, opVal))
              return false
            break
          case '$ne':
            if (areEqual(value, opVal))
              return false
            break
          case '$gt':
            if (!(value > opVal))
              return false
            break
          case '$gte':
            if (!(value >= opVal))
              return false
            break
          case '$lt':
            if (!(value < opVal))
              return false
            break
          case '$lte':
            if (!(value <= opVal))
              return false
            break
          case '$in':
            if (!Array.isArray(opVal))
              return false
            if (!opVal.some(item => areEqual(value, item)))
              return false
            break
          case '$nin':
            if (!Array.isArray(opVal))
              return false
            if (opVal.some(item => areEqual(value, item)))
              return false
            break
          case '$exists':
          { const exists = value !== undefined
            if (exists !== !!opVal)
              return false
            break }
          default:
            break
        }
      }
    }
    else {
      // Implicit equality
      if (!areEqual(value, fieldFilter)) {
        return false
      }
    }
  }

  return true
}
