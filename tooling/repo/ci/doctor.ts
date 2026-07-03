#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { $ } from 'bun'
import { findRuntimeBoundaryViolations } from '../lib/runtime-boundaries.ts'

const repoRoot = resolve(import.meta.dirname, '../../..')
const expectedEnvExamples = [
  'apps/api/.env.example',
  'apps/api/.dev.vars.example',
  'tooling/seeding/.env.example',
  'tooling/seeding/.env.staging.example',
]

const trackedEnvOutput = await $`git -C ${repoRoot} ls-files -- ${'*.env*'}`.text()
const trackedEnvFiles = trackedEnvOutput
  .split('\n')
  .filter(path => path && existsSync(resolve(repoRoot, path)))
const unexpectedTrackedEnvFiles = trackedEnvFiles.filter((path) => {
  const name = basename(path)
  return name !== '.env.example' && !/^\.env\..+\.example$/.test(name)
})
const missingEnvExamples = expectedEnvExamples.filter(path => !existsSync(resolve(repoRoot, path)))

if (unexpectedTrackedEnvFiles.length > 0 || missingEnvExamples.length > 0) {
  if (unexpectedTrackedEnvFiles.length > 0) {
    console.error('Tracked runtime environment files:')
    unexpectedTrackedEnvFiles.forEach(path => console.error(`  - ${path}`))
  }
  if (missingEnvExamples.length > 0) {
    console.error('Missing environment examples:')
    missingEnvExamples.forEach(path => console.error(`  - ${path}`))
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
