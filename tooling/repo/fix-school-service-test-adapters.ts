/**
 * Point school-service test adapter imports at @edaya/core.
 * Run: bun tooling/repo/fix-school-service-test-adapters.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const testsDir = join(import.meta.dir, '../../package/school-service/tests')

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory())
      files.push(...walk(path))
    else if (entry.endsWith('.ts'))
      files.push(path)
  }
  return files
}

const adapterImport = /import\s+\{([^}]+)\}\s+from\s+['"][^'"]*src\/adapters[^'"]*['"];?/g

let changed = 0
for (const file of walk(testsDir)) {
  const original = readFileSync(file, 'utf8')
  const updated = original.replace(adapterImport, 'import {$1} from "@edaya/core"')
  if (updated !== original) {
    writeFileSync(file, updated)
    changed++
  }
}

console.log(`Updated ${changed} school-service test files`)
