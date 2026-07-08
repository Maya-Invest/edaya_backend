/**
 * One-shot import rewriter for core / authorization / school-service package split.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dir, '../..')

function walk(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (entry === 'node_modules')
        continue
      files.push(...walk(path))
    }
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      files.push(path)
    }
  }
  return files
}

function rewriteSchoolService(content: string, filePath: string): string {
  const rel = relative(join(root, 'package/school-service/src'), filePath)
  const inServices = rel.startsWith('services' + '/') || rel === 'services'
  const inCapabilities = rel.startsWith('capabilities' + '/')

  let next = content

  // application → services (relative within package)
  next = next.replace(/from '(\.\.\/)+application\//g, (match) => {
    const depth = (match.match(/\.\.\//g) ?? []).length
    if (inServices) {
      const up = Math.max(1, depth - 1)
      return `from '${'../'.repeat(up)}services/`.replace('../services/', '../')
    }
    return `from '${'../'.repeat(depth)}services/`
  })

  // domain → @edaya/core
  next = next.replace(
    /from '(?:\.\.\/)+domain(?:\/([^']+))?'/g,
    (_match, subpath: string | undefined) =>
      subpath ? `from '@edaya/core/domain/${subpath}'` : `from '@edaya/core'`,
  )

  // ports → @edaya/core
  next = next.replace(
    /from '(?:\.\.\/)+ports(?:\/([^']+))?'/g,
    (_match, subpath: string | undefined) =>
      subpath ? `from '@edaya/core/ports/${subpath}'` : `from '@edaya/core'`,
  )

  // authorization capability path → @edaya/authorization
  next = next.replace(
    /from '(?:\.\.\/)+capabilities\/authorization(?:\/([^']+))?'/g,
    (_match, subpath: string | undefined) =>
      subpath ? `from '@edaya/authorization/${subpath}'` : `from '@edaya/authorization'`,
  )
  if (inCapabilities) {
    next = next.replace(
      /from '\.\.\/authorization(?:\/([^']+))?'/g,
      (_match, subpath: string | undefined) =>
        subpath ? `from '@edaya/authorization/${subpath}'` : `from '@edaya/authorization'`,
    )
  }

  // other capabilities stay relative within school-service
  if (inServices) {
    next = next.replace(
      /from '(?:\.\.\/)+capabilities\/(?!authorization)([^']+)'/g,
      'from \'../../capabilities/$1\'',
    )
  }

  return next
}

function rewriteAuthorization(content: string): string {
  let next = content

  next = next.replace(
    /from '(?:\.\.\/)+domain(?:\/([^']+))?'/g,
    (_match, subpath: string | undefined) =>
      subpath ? `from '@edaya/core/domain/${subpath}'` : `from '@edaya/core'`,
  )

  next = next.replace(
    /from '(?:\.\.\/)+ports(?:\/([^']+))?'/g,
    (_match, subpath: string | undefined) =>
      subpath ? `from '@edaya/core/ports/${subpath}'` : `from '@edaya/core'`,
  )

  next = next.replace(
    /from '(?:\.\.\/)+application(?:\/([^']+))?'/g,
    (_match, subpath: string | undefined) =>
      subpath ? `from '@edaya/school-service/services/${subpath}'` : `from '@edaya/school-service'`,
  )

  return next
}

function rewriteCore(content: string): string {
  let next = content

  next = next.replace(
    /from '(?:\.\.\/)+application(?:\/([^']+))?'/g,
    (_match, subpath: string | undefined) =>
      subpath ? `from '@edaya/school-service/services/${subpath}'` : `from '@edaya/school-service'`,
  )

  next = next.replace(
    /from '(?:\.\.\/)+capabilities\/authorization(?:\/([^']+))?'/g,
    (_match, subpath: string | undefined) =>
      subpath ? `from '@edaya/authorization/${subpath}'` : `from '@edaya/authorization'`,
  )

  next = next.replace(
    /from '(?:\.\.\/)+capabilities\/(?!authorization)([^']+)'/g,
    (_match, subpath: string) => `from '@edaya/school-service/capabilities/${subpath}'`,
  )

  return next
}

const packages = [
  { name: 'school-service', dir: join(root, 'package/school-service/src'), rewrite: rewriteSchoolService },
  { name: 'school-service-tests', dir: join(root, 'package/school-service/tests'), rewrite: rewriteSchoolService },
  { name: 'authorization', dir: join(root, 'package/authorization/src'), rewrite: (c: string) => rewriteAuthorization(c) },
  { name: 'authorization-tests', dir: join(root, 'package/authorization/tests'), rewrite: (c: string) => rewriteAuthorization(c) },
  { name: 'domain-core', dir: join(root, 'package/domain-core/src'), rewrite: (c: string) => rewriteCore(c) },
  { name: 'domain-core-tests', dir: join(root, 'package/domain-core/tests'), rewrite: (c: string) => rewriteCore(c) },
] as const

let changed = 0
for (const pkg of packages) {
  for (const file of walk(pkg.dir)) {
    const original = readFileSync(file, 'utf8')
    const updated = pkg.name.startsWith('school-service')
      ? rewriteSchoolService(original, file.startsWith(join(root, 'package/school-service/src')) ? file : join(root, 'package/school-service/src/_'))
      : pkg.rewrite(original)
    if (updated !== original) {
      writeFileSync(file, updated)
      changed++
    }
  }
}

console.log(`Updated ${changed} files`)
