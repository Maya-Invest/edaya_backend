#!/usr/bin/env bun
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, test } from 'bun:test'

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
    pattern: /from ["']@\/http/,
    searchPath: 'apps/api/src/runtime',
  },
  {
    label: 'core imports integrations',
    pattern: /from ["']@edaya\/(neon-migrations|betterauth-d1-migrations)/,
    searchPath: 'package/domain-core/src',
  },
  {
    label: 'core imports apps',
    pattern: /from ["']@\//,
    searchPath: 'package/domain-core/src',
  },
  ...['package/domain-core', 'package/adaptor-postgres', 'package/generated-api-client', 'package/adaptor-novu'].map(
    (searchPath): BoundaryCheck => ({
      label: 'package imports integrations',
      pattern: /from ["']@edaya\/(neon-migrations|betterauth-d1-migrations)/,
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

function main(): void {
  const repoRoot = resolve(import.meta.dirname, '..')
  const violations = findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, repoRoot)

  if (violations.length > 0) {
    for (const { label, matches } of violations) {
      console.error(`Boundary violation: ${label}`)
      for (const match of matches) {
        console.error(match)
      }
      console.error()
    }
    console.error(`${violations.length} boundary check(s) failed.`)
    process.exitCode = 1
    return
  }

  console.log('Import boundary checks passed.')
}

function registerTests(): void {
  const temporaryDirectories: string[] = []

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  function createRepoRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'edaya-boundary-test-'))
    temporaryDirectories.push(root)
    return root
  }

  function writeSource(root: string, relativePath: string, contents: string): void {
    const filePath = join(root, relativePath)
    mkdirSync(join(filePath, '..'), { recursive: true })
    writeFileSync(filePath, contents)
  }

  describe('findBoundaryViolations', () => {
    test('reports no violations for clean imports', () => {
      const root = createRepoRoot()
      writeSource(root, 'apps/api/src/runtime/node/create-runtime.ts', `import { foo } from '../shared/foo'\n`)
      writeSource(root, 'package/domain-core/src/index.ts', `import { bar } from '@edaya/adaptor-postgres'\n`)

      expect(findBoundaryViolations([
        {
          label: 'runtime imports http',
          pattern: /from ["']@\/http/,
          searchPath: 'apps/api/src/runtime',
        },
        {
          label: 'core imports apps',
          pattern: /from ["']@\//,
          searchPath: 'package/domain-core/src',
        },
      ], root)).toEqual([])
    })

    test('reports runtime imports of http layer', () => {
      const root = createRepoRoot()
      writeSource(root, 'apps/api/src/runtime/node/create-runtime.ts', `import { app } from '@/http/app'\n`)

      expect(findBoundaryViolations([
        {
          label: 'runtime imports http',
          pattern: /from ["']@\/http/,
          searchPath: 'apps/api/src/runtime',
        },
      ], root)).toEqual([{
        label: 'runtime imports http',
        matches: ['apps/api/src/runtime/node/create-runtime.ts:1:import { app } from \'@/http/app\''],
      }])
    })

    test('reports core imports of integration packages', () => {
      const root = createRepoRoot()
      writeSource(root, 'package/domain-core/src/index.ts', `import { migrate } from '@edaya/neon-migrations'\n`)

      expect(findBoundaryViolations([
        {
          label: 'core imports integrations',
          pattern: /from ["']@edaya\/(neon-migrations|betterauth-d1-migrations)/,
          searchPath: 'package/domain-core/src',
        },
      ], root)).toEqual([{
        label: 'core imports integrations',
        matches: ['package/domain-core/src/index.ts:1:import { migrate } from \'@edaya/neon-migrations\''],
      }])
    })

    test('ignores files under excluded directories', () => {
      const root = createRepoRoot()
      writeSource(root, 'apps/api/src/runtime/node_modules/bad.ts', `import { app } from '@/http/app'\n`)
      writeSource(root, 'apps/api/src/runtime/dist/bad.ts', `import { app } from '@/http/app'\n`)

      expect(findBoundaryViolations([
        {
          label: 'runtime imports http',
          pattern: /from ["']@\/http/,
          searchPath: 'apps/api/src/runtime',
        },
      ], root)).toEqual([])
    })
  })
}

if (import.meta.main) {
  try {
    registerTests()
  }
  catch {
    main()
  }
}
