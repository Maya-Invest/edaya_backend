import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.svelte-kit'])

export interface BoundaryCheck {
  label: string
  pattern: RegExp
  searchPath: string
  excludePath?: string
}

export interface BoundaryViolation {
  label: string
  matches: string[]
}

export const IMPORT_BOUNDARY_CHECKS: BoundaryCheck[] = [
  ...['domain-core', 'domain-authorization', 'domain-service'].map(name => ({
    label: 'domain imports infrastructure or transport',
    pattern: /(?:from\s+|import\s*\()["'](?:@edaya\/adaptor-|hono|@hono\/|exceljs|xlsx|drizzle-orm|pg["'/]|cloudflare:|[^"']*(?:apps|tooling)\/)/,
    searchPath: `package/${name}/src`,
  })),
  {
    label: 'import format adapter calls application workflows',
    pattern: /(?:from\s+|import\s*\()["'](?:@edaya\/(?:service|authorization)|[^"']*(?:apps|tooling|domain-service|domain-authorization)\/)/,
    searchPath: 'package/adaptor-import-format/src',
  },
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
    label: 'api imports repository tooling',
    pattern: /from ["'](?:@edaya\/(?:repo|client-codegen|db-migrate|identity-migrate)|[^"']*tooling\/repo\/)/,
    searchPath: 'apps/api/src',
  },
  {
    label: 'core imports identity client',
    pattern: /from ["'](?:@maya-invest\/edaya-identity-client|[^"']*apps\/api\/src\/identity)/,
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
      pattern: /from ["'](?:@maya-invest\/edaya-identity-client|[^"']*apps\/api\/src\/identity)/,
      searchPath,
    }),
  ),
  ...['package/domain-core', 'package/adaptor-postgres', 'package/adaptor-notify', 'package/adaptor-docs', 'package/adaptor-r2', 'package/adaptor-local-fs'].map(
    (searchPath): BoundaryCheck => ({
      label: 'package imports identity client',
      pattern: /from ["'](?:@maya-invest\/edaya-identity-client|[^"']*apps\/api\/src\/identity)/,
      searchPath,
    }),
  ),
  {
    label: 'school imports adaptor-auth',
    pattern: /from ["'](?:@edaya\/(?:adaptor-auth|adaptor-account|account)|better-auth)/,
    searchPath: 'apps/api/src',
    excludePath: 'apps/api/src/identity',
  },
  ...['domain-core', 'domain-authorization', 'domain-service', 'adaptor-postgres', 'adaptor-notify', 'adaptor-docs', 'adaptor-r2', 'adaptor-local-fs', 'api-client'].map(name => ({
    label: 'school packages import provider authentication internals',
    pattern: /from ["'](?:@edaya\/adaptor-auth|better-auth)/,
    searchPath: `package/${name}/src`,
  })),
  {
    label: 'Account domain imports a framework or adapter',
    pattern: /from ["'](?:@edaya\/adaptor-|better-auth|hono|drizzle-orm|@\/)/,
    searchPath: 'package/domain-account/src',
  },
  ...['domain-account', 'adaptor-account', 'adaptor-auth-better-auth'].map(name => ({
    label: 'Account package imports application composition',
    pattern: /from ["'](?:.*\/apps\/|@\/)/,
    searchPath: `package/${name}/src`,
  })),
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
    const excludedPrefix = check.excludePath
      ? `${resolve(repoRoot, check.excludePath).replaceAll('\\', '/')}/`
      : undefined
    const matches = (statSync(searchDirectory).isFile() ? [searchDirectory] : [...walkFiles(searchDirectory)]).filter(filePath => !excludedPrefix || !filePath.replaceAll('\\', '/').startsWith(excludedPrefix)).flatMap(filePath => (
      findMatchesInFile(filePath, check.pattern, repoRoot)
    ))

    return matches.length > 0 ? [{ label: check.label, matches }] : []
  })
}
