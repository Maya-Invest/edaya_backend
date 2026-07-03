export type ScopePathSegment = string | '*'

export interface ParsedScopePath {
  readonly segments: readonly ScopePathSegment[]
}

export interface ParsedScopeClause {
  readonly paths: readonly ParsedScopePath[]
}

export interface ParsedScopeIds {
  readonly clauses: readonly ParsedScopeClause[]
}

const ID_PATTERN = /^[^\s:;,]+$/

export function parseScopeIds(scopeIds: string): ParsedScopeIds {
  if (scopeIds === '') {
    return { clauses: [] }
  }

  const clauses = scopeIds.split(';').map(clause => clause.trim()).filter(Boolean)
  if (clauses.length === 0) {
    throw new ScopeIdsParseError('scopeIds must not contain only separators')
  }

  return {
    clauses: clauses.map((clause) => {
      const paths = clause.split(',').map(path => path.trim()).filter(Boolean)
      if (paths.length === 0) {
        throw new ScopeIdsParseError(`Empty path list in clause "${clause}"`)
      }

      return {
        paths: paths.map((path) => {
          const segments = path.split(':').map(segment => segment.trim())
          if (segments.length === 0 || segments.includes('')) {
            throw new ScopeIdsParseError(`Invalid path "${path}"`)
          }

          for (const segment of segments) {
            if (segment === '*') {
              if (segment !== segments[segments.length - 1]) {
                throw new ScopeIdsParseError(`Wildcard must be the last segment in "${path}"`)
              }
              continue
            }
            if (!ID_PATTERN.test(segment)) {
              throw new ScopeIdsParseError(`Invalid segment "${segment}" in path "${path}"`)
            }
          }

          return { segments: Object.freeze(segments) }
        }),
      }
    }),
  }
}

export function serializeScopeIds(parsed: ParsedScopeIds): string {
  if (parsed.clauses.length === 0) {
    return ''
  }

  return parsed.clauses
    .map(clause => clause.paths.map(path => path.segments.join(':')).join(','))
    .join(';')
}

export function mergeScopeIdClauses(...parts: readonly string[]): string {
  const clauses = parts
    .flatMap(part => part.split(';'))
    .map(clause => clause.trim())
    .filter(Boolean)

  return [...new Set(clauses)].join(';')
}

export class ScopeIdsParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScopeIdsParseError'
  }
}
