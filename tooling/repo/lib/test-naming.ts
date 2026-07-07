import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const FORBIDDEN_NAME_SEGMENTS = new Set([
  'coverage',
  'regression',
  'final',
  'gap',
  'utils',
  'helpers',
  'misc',
  'temp',
  'fix',
])

const TEST_SEARCH_ROOTS = [
  'apps',
  'package',
  'tooling',
] as const

const EXCLUDED_PATH_PREFIXES = [
  'tooling/integration-tests/',
] as const

export interface TestNamingViolation {
  path: string
  segments: readonly string[]
}

function shouldSkipRelativePath(relativePath: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some(prefix => relativePath.startsWith(prefix))
}

function forbiddenSegmentsInTestFilename(filename: string): string[] {
  const stem = filename.replace(/\.test\.ts$/, '')
  const segments = stem.split(/[-_/]+/).map(segment => segment.toLowerCase())
  return segments.filter(segment => FORBIDDEN_NAME_SEGMENTS.has(segment))
}

function walkTestFiles(directory: string, repoRoot: string, matches: TestNamingViolation[]): void {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry)
    const relativePath = relative(repoRoot, absolutePath).replaceAll('\\', '/')

    if (shouldSkipRelativePath(relativePath)) {
      continue
    }

    const stats = statSync(absolutePath)
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') {
        continue
      }
      walkTestFiles(absolutePath, repoRoot, matches)
      continue
    }

    if (!entry.endsWith('.test.ts')) {
      continue
    }

    const forbidden = forbiddenSegmentsInTestFilename(entry)
    if (forbidden.length > 0) {
      matches.push({ path: relativePath, segments: forbidden })
    }
  }
}

export function findTestNamingViolations(repoRoot: string): TestNamingViolation[] {
  const violations: TestNamingViolation[] = []

  for (const root of TEST_SEARCH_ROOTS) {
    const searchPath = join(repoRoot, root)
    try {
      walkTestFiles(searchPath, repoRoot, violations)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  return violations.sort((left, right) => left.path.localeCompare(right.path))
}
