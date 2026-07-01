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
    label: 'core imports integrations',
    pattern: /from ["']@edaya\/integration-migrations/,
    searchPath: 'package/domain-core/src',
  },
  {
    label: 'core imports apps',
    pattern: /from ["']@\//,
    searchPath: 'package/domain-core/src',
  },
  ...['package/domain-core', 'package/adaptor-postgres', 'package/adaptor-novu', 'package/adaptor-r2'].map(
    (searchPath): BoundaryCheck => ({
      label: 'package imports integrations',
      pattern: /from ["']@edaya\/integration-migrations/,
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
