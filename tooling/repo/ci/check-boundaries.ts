#!/usr/bin/env bun
import { resolve } from 'node:path'
import process from 'node:process'
import { findBoundaryViolations, IMPORT_BOUNDARY_CHECKS } from '../lib/boundaries.ts'

const repoRoot = resolve(import.meta.dirname, '../../..')
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
}
else {
  console.log('Import boundary checks passed.')
}
