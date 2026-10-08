#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { $ } from 'bun'
import { findLayoutIdentityViolations } from '../lib/layout-identity.ts'
import { findRuntimeBoundaryViolations } from '../lib/runtime-boundaries.ts'

const repoRoot = resolve(import.meta.dirname, '../../..')
const expectedEnvExamples = [
  'apps/api/.env.example',
  'apps/api/.dev.vars.example',
  '.env.example',
]
const expectedSecretExamples = [
  'apps/api/secrets.json.example',
]

function isAllowedTrackedEnvFile(name: string): boolean {
  return name === '.env.example'
    || /^\.env\..+\.example$/.test(name)
}

const trackedEnvOutput = await $`git -C ${repoRoot} ls-files -- ${'*.env*'}`.text()
const trackedEnvFiles = trackedEnvOutput
  .split('\n')
  .filter(path => path && existsSync(resolve(repoRoot, path)))
const unexpectedTrackedEnvFiles = trackedEnvFiles.filter((path) => {
  return !isAllowedTrackedEnvFile(basename(path))
})
const missingEnvExamples = expectedEnvExamples.filter(path => !existsSync(resolve(repoRoot, path)))
const missingSecretExamples = expectedSecretExamples.filter(path => !existsSync(resolve(repoRoot, path)))

if (unexpectedTrackedEnvFiles.length > 0 || missingEnvExamples.length > 0 || missingSecretExamples.length > 0) {
  if (unexpectedTrackedEnvFiles.length > 0) {
    console.error('Tracked runtime environment files:')
    unexpectedTrackedEnvFiles.forEach(path => console.error(`  - ${path}`))
  }
  if (missingEnvExamples.length > 0) {
    console.error('Missing environment examples:')
    missingEnvExamples.forEach(path => console.error(`  - ${path}`))
  }
  if (missingSecretExamples.length > 0) {
    console.error('Missing Wrangler secret examples:')
    missingSecretExamples.forEach(path => console.error(`  - ${path}`))
  }
  process.exitCode = 1
}
else {
  console.log('Repository environment file checks passed.')
}

const runtimeBoundaryViolations = findRuntimeBoundaryViolations(repoRoot)
if (runtimeBoundaryViolations.length > 0) {
  console.error('Runtime boundary checks failed:')
  runtimeBoundaryViolations.forEach(violation => console.error(`  - ${violation.label}: ${violation.message}`))
  process.exitCode = 1
}
else {
  console.log('Runtime boundary checks passed.')
}

const layoutIdentityViolations = findLayoutIdentityViolations(repoRoot)
if (layoutIdentityViolations.length > 0) {
  console.error('Layout identity checks failed:')
  layoutIdentityViolations.forEach(violation => console.error(`  - ${violation.label}: ${violation.message}`))
  process.exitCode = 1
}
else {
  console.log('Layout identity checks passed.')
}
