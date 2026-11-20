import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { IMPORT_BOUNDARY_CHECKS } from './boundaries.ts'

export interface LayoutIdentityViolation {
  label: string
  message: string
}

const ESLINT_RESTRICTED_FILES_GLOB = /files:\s*\[\s*'([^']+)'\s*\]/g

export function extractEslintRestrictedImportGlobs(eslintConfigSource: string): string[] {
  const restrictedBlocks = eslintConfigSource.split(/\}, \{/).filter(block =>
    block.includes('no-restricted-imports'),
  )

  const globs = new Set<string>()
  for (const block of restrictedBlocks) {
    for (const match of block.matchAll(ESLINT_RESTRICTED_FILES_GLOB)) {
      const glob = match[1]
      if (glob) {
        globs.add(glob)
      }
    }
  }

  return [...globs]
}

export function globToExistingPathPrefix(glob: string): string {
  return glob
    .replace(/\/\*\*\/\*\.[^/]+$/, '')
    .replace(/\/\*\*$/, '')
    .replace(/\/\*$/, '')
}

function directoryHasMatchingFiles(directory: string, glob: string): boolean {
  const suffixMatch = glob.match(/\*\.(\w+)$/)
  const extension = suffixMatch ? `.${suffixMatch[1]}` : '.ts'

  function walk(current: string): boolean {
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry)
      if (statSync(fullPath).isDirectory()) {
        if (walk(fullPath)) {
          return true
        }
        continue
      }
      if (entry.endsWith(extension)) {
        return true
      }
    }
    return false
  }

  return walk(directory)
}

export function findLayoutIdentityViolations(repoRoot: string): LayoutIdentityViolation[] {
  const violations: LayoutIdentityViolation[] = []
  const seenSearchPaths = new Set<string>()

  for (const check of IMPORT_BOUNDARY_CHECKS) {
    if (seenSearchPaths.has(check.searchPath)) {
      continue
    }
    seenSearchPaths.add(check.searchPath)

    const searchDirectory = resolve(repoRoot, check.searchPath)
    if (!existsSync(searchDirectory)) {
      violations.push({
        label: check.label,
        message: `boundary searchPath does not exist: ${check.searchPath}`,
      })
    }
  }

  const eslintConfigPath = resolve(repoRoot, 'eslint.config.js')
  if (!existsSync(eslintConfigPath)) {
    violations.push({
      label: 'eslint restricted-import globs',
      message: 'missing eslint.config.js',
    })
    return violations
  }

  const eslintSource = readFileSync(eslintConfigPath, 'utf8')
  const globs = extractEslintRestrictedImportGlobs(eslintSource)
  if (globs.length === 0) {
    violations.push({
      label: 'eslint restricted-import globs',
      message: 'no restricted-import files globs found in eslint.config.js',
    })
    return violations
  }

  for (const glob of globs) {
    const prefix = globToExistingPathPrefix(glob)
    const directory = resolve(repoRoot, prefix)
    if (!existsSync(directory)) {
      violations.push({
        label: 'eslint restricted-import globs',
        message: `glob matches no directory: ${glob} (${prefix})`,
      })
      continue
    }
    if (!directoryHasMatchingFiles(directory, glob)) {
      violations.push({
        label: 'eslint restricted-import globs',
        message: `glob matches zero files: ${glob}`,
      })
    }
  }

  return violations
}
