#!/usr/bin/env bun
import { resolve } from 'node:path'
import process from 'node:process'
import { findTestNamingViolations } from '../lib/test-naming.ts'

const repoRoot = resolve(import.meta.dirname, '../../..')
const violations = findTestNamingViolations(repoRoot)

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`Forbidden test filename segment(s) [${violation.segments.join(', ')}]: ${violation.path}`)
  }
  console.error(`${violations.length} test naming violation(s). See docs/sprints/unit-test-coverage-plan.md §4.`)
  process.exitCode = 1
}
else {
  console.log('Test naming checks passed.')
}
