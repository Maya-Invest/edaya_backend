import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
/**
 * Rewrites @edaya/service/* internal imports in school-service tests to relative src paths.
 */
import { dirname, join, relative } from 'node:path'

const testsDir = join(import.meta.dir, '../../package/domain-service/tests')
const srcDir = join(import.meta.dir, '../../package/domain-service/src')

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

const pattern = /from ["']@edaya\/service\/(capabilities|services|integration)\/([^"']+)["']/g

let changed = 0
for (const file of walk(testsDir)) {
  const original = readFileSync(file, 'utf8')
  const updated = original.replace(pattern, (_full, _area, subpath) => {
    const importPath = join(srcDir, _area, subpath)
    let rel = relative(dirname(file), importPath).replace(/\\/g, '/')
    if (!rel.startsWith('.'))
      rel = `./${rel}`
    return `from "${rel}"`
  })
  if (updated !== original) {
    writeFileSync(file, updated)
    changed++
  }
}

console.log(`Updated ${changed} school-service test files with relative imports`)
