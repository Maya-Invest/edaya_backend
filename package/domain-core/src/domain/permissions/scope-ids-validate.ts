import type { ScopeType } from './scope-type'
import { parseScopeIds, ScopeIdsParseError } from './scope-ids-parse'
import { scopeSegmentBounds } from './scope-segments'

export class ScopeIdsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScopeIdsValidationError'
  }
}

export function validateScopeIds(scopeIds: string, permissionScope?: ScopeType): void {
  try {
    if (scopeIds === '') {
      if (permissionScope !== undefined) {
        throw new ScopeIdsValidationError('scopeIds must be non-empty when permission has a scope')
      }
      return
    }

    if (permissionScope === undefined) {
      throw new ScopeIdsValidationError('scopeIds must be empty for tenant-wide permissions')
    }

    if (permissionScope === 'student' || permissionScope === 'platform') {
      throw new ScopeIdsValidationError(`scopeIds are not used for permission scope "${permissionScope}"`)
    }

    const parsed = parseScopeIds(scopeIds)
    const bounds = scopeSegmentBounds(permissionScope)

    for (const clause of parsed.clauses) {
      for (const path of clause.paths) {
        const count = path.segments.length
        if (count < bounds.min || count > bounds.max) {
          throw new ScopeIdsValidationError(
            `Path "${path.segments.join(':')}" must have ${bounds.min}${bounds.max === bounds.min ? '' : `–${bounds.max}`} segment(s) for scope "${permissionScope}"`,
          )
        }
      }
    }
  }
  catch (error) {
    if (error instanceof ScopeIdsParseError) {
      throw new ScopeIdsValidationError(error.message)
    }
    throw error
  }
}
