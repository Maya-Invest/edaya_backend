import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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
  ...['documents/assembly', 'family-feedback/compute-campaign-aggregates.ts', 'finance/load-finance-reconciliation.ts', 'scheduling/materialize-occurrences.ts'].map(path => ({
    label: 'extracted business operation imports the broad service or escapes repository dependencies',
    pattern: /\bBaseSchoolService\b|repositories\s*:\s*SchoolRepositories\b|DocumentAssemblyContext<\s*keyof\s+SchoolRepositories/,
    searchPath: `package/domain-service/src/capabilities/${path}`,
  })),
  ...['finance', 'assessments', 'scheduling', 'family-feedback', 'documents'].map(name => ({
    label: 'migrated workflow bypasses its explicit repository dependencies',
    pattern: /this\.baseService\.repositories|this\.base\.repositories/,
    searchPath: `package/domain-service/src/services/workflows/${name}.ts`,
  })),
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
    label: 'core imports identity client',
    pattern: /from ["']@maya-invest\/edaya-identity-client/,
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
    label: 'adaptor-notify imports school-service',
    pattern: /from ["']@edaya\/service/,
    searchPath: 'package/adaptor-notify/src',
  },
  {
    label: 'adaptor-docs imports school-service',
    pattern: /from ["']@edaya\/service/,
    searchPath: 'package/adaptor-docs/src',
  },
  ...['package/domain-core', 'package/domain-authorization', 'package/domain-service'].map(
    (searchPath): BoundaryCheck => ({
      label: 'domain package imports identity client',
      pattern: /from ["']@maya-invest\/edaya-identity-client/,
      searchPath,
    }),
  ),
  ...['package/domain-core', 'package/adaptor-postgres', 'package/adaptor-notify', 'package/adaptor-docs', 'package/adaptor-r2', 'package/adaptor-local-fs'].map(
    (searchPath): BoundaryCheck => ({
      label: 'package imports identity client',
      pattern: /from ["']@maya-invest\/edaya-identity-client/,
      searchPath,
    }),
  ),
  {
    label: 'school imports adaptor-auth',
    pattern: /from ["']@edaya\/adaptor-auth/,
    searchPath: 'apps/api/src',
  },
  {
    label: 'school packages import adaptor-auth',
    pattern: /from ["']@edaya\/adaptor-auth/,
    searchPath: 'package',
  },
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
  const relativePath = relative(repoRoot, filePath).replaceAll('\\', '/')

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
    if (!existsSync(searchDirectory)) {
      return []
    }
    const matches = (statSync(searchDirectory).isFile() ? [searchDirectory] : [...walkFiles(searchDirectory)]).flatMap(filePath => (
      findMatchesInFile(filePath, check.pattern, repoRoot)
    ))

    return matches.length > 0 ? [{ label: check.label, matches }] : []
  })
}
