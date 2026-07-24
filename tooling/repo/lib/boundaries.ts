import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.svelte-kit'])

export interface BoundaryCheck {
  label: string
  pattern: RegExp
  searchPath: string
}

export interface BoundaryViolation {
  label: string
  matches: string[]
}

export const IMPORT_BOUNDARY_CHECKS: BoundaryCheck[] = [
  {
    label: 'runtime imports http',
    pattern: /from ["']@\/http\/(?!bindings)/,
    searchPath: 'apps/api/src/runtime',
  },
  {
    label: 'api imports db-migrate tooling',
    pattern: /from ["']@edaya\/db-migrate/,
    searchPath: 'apps/api/src',
  },
  {
    label: 'api imports novu-ops tooling',
    pattern: /from ["']@edaya\/novu-ops/,
    searchPath: 'apps/api/src',
  },
  {
    label: 'core imports adaptor-auth',
    pattern: /from ["']@edaya\/adaptor-auth/,
    searchPath: 'package/domain-core/src',
  },
  {
    label: 'core imports apps',
    pattern: /from ["']@\//,
    searchPath: 'package/domain-core/src',
  },
  {
    label: 'core imports school-service',
    pattern: /from ["']@edaya\/service/,
    searchPath: 'package/domain-core/src',
  },
  {
    label: 'core imports authorization',
    pattern: /from ["']@edaya\/authorization/,
    searchPath: 'package/domain-core/src',
  },
  {
    label: 'authorization imports school-service',
    pattern: /from ["']@edaya\/service/,
    searchPath: 'package/domain-authorization/src',
  },
  {
    label: 'authorization imports apps',
    pattern: /from ["']@\//,
    searchPath: 'package/domain-authorization/src',
  },
  {
    label: 'school-service imports apps',
    pattern: /from ["']@\//,
    searchPath: 'package/domain-service/src',
  },
  ...['package/domain-core', 'package/domain-authorization', 'package/domain-service'].map(
    (searchPath): BoundaryCheck => ({
      label: 'domain package imports adaptor-auth',
      pattern: /from ["']@edaya\/adaptor-auth/,
      searchPath,
    }),
  ),
  ...['package/domain-core', 'package/adaptor-postgres', 'package/adaptor-novu', 'package/adaptor-r2', 'package/adaptor-local-fs'].map(
    (searchPath): BoundaryCheck => ({
      label: 'package imports adaptor-auth',
      pattern: /from ["']@edaya\/adaptor-auth/,
      searchPath,
    }),
  ),
  ...['package/document-contracts', 'package/document-rendering', 'package/docs-client', 'apps/docs'].map(
    (searchPath): BoundaryCheck => ({
      label: 'docs packages import school domain',
      pattern: /from ["']@edaya\/(core|service|authorization|adaptor-postgres|adaptor-auth|adaptor-novu|adaptor-r2|adaptor-local-fs)["']/,
      searchPath,
    }),
  ),
]

function* walkFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        yield* walkFiles(fullPath)
      }
      continue
    }

    if (entry.isFile()) {
      yield fullPath
    }
  }
}

function findMatchesInFile(
  filePath: string,
  pattern: RegExp,
  repoRoot: string,
): string[] {
  const lines = readFileSync(filePath, 'utf8').split('\n')
  const relativePath = relative(repoRoot, filePath)

  return lines.flatMap((line, index) => (
    pattern.test(line) ? [`${relativePath}:${index + 1}:${line}`] : []
  ))
}

export function findBoundaryViolations(
  checks: BoundaryCheck[],
  repoRoot: string,
): BoundaryViolation[] {
  return checks.flatMap((check) => {
    const searchDirectory = resolve(repoRoot, check.searchPath)
    const matches = [...walkFiles(searchDirectory)].flatMap(filePath => (
      findMatchesInFile(filePath, check.pattern, repoRoot)
    ))

    return matches.length > 0 ? [{ label: check.label, matches }] : []
  })
}
