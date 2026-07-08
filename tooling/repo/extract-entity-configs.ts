/**
 * PR3: Extract *Config factories from domain-core entity files into school-service config/.
 *
 * Usage: bun tooling/repo/extract-entity-configs.ts [--dry-run]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '../..')
const DOMAIN_ROOT = join(ROOT, 'package/domain-core/src/domain')
const CONFIG_ROOT = join(ROOT, 'package/school-service/src/services/entities/config')
const DRY_RUN = process.argv.includes('--dry-run')

function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full))
    }
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

function depthFromConfig(filePath: string): number {
  const rel = relative(CONFIG_ROOT, filePath)
  const segments = rel.split('/')
  return segments.length - 1
}

function entityConfigImportPath(configFile: string): string {
  const depth = depthFromConfig(configFile)
  return `${'../'.repeat(depth + 1)}entity-config`
}

function rewriteRelativeImports(configBody: string, domainFile: string, configFile: string): string {
  const domainDir = dirname(domainFile)
  const entityConfigPath = entityConfigImportPath(configFile)

  return configBody
    .replace(/from ['"]\.\.\/shared\/utils['"]/g, `from '@edaya/core'`)
    .replace(/from ['"]\.\.\/\.\.\/domain\/shared\/business-rule-error['"]/g, `from '@edaya/core'`)
    .replace(/from ['"]\.\.\/\.\.\/domain\/value-objects\/([^'"]+)['"]/g, `from '@edaya/core'`)
    .replace(/from ['"](\.\.?\/[^'"]+)['"]/g, (match, importPath: string) => {
      const resolved = join(domainDir, importPath)
      const relToDomain = relative(DOMAIN_ROOT, resolved)
      if (!relToDomain.startsWith('..')) {
        const withoutExt = relToDomain.replace(/\.ts$/, '')
        return `from '@edaya/core/${withoutExt}'`
      }
      return match
    })
    .replace(/from ['"]@edaya\/school-service['"]/g, `from '${entityConfigPath}'`)
}

function collectDomainImports(domainHeader: string): string[] {
  const lines: string[] = []
  for (const line of domainHeader.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('import ')) {
      if (
        trimmed.includes('@edaya/school-service')
        || trimmed.includes('@edaya/authorization')
        || trimmed.includes('EntityConfigFactory')
      ) {
        lines.push(line)
      }
    }
  }
  return lines
}

function collectEntitySymbols(domainHeader: string, configBody: string): { types: string[], values: string[] } {
  const types = new Set<string>()
  const values = new Set<string>()

  const classMatch = domainHeader.match(/export class (\w+)/)
  if (classMatch) {
    values.add(classMatch[1])
  }

  const enumMatches = domainHeader.matchAll(/export enum (\w+)/g)
  for (const match of enumMatches) {
    values.add(match[1]!)
  }

  const exportedFns = domainHeader.matchAll(/export (?:async )?function (\w+)/g)
  for (const match of exportedFns) {
    if (configBody.includes(match[1]!)) {
      values.add(match[1]!)
    }
  }

  const typeExports = domainHeader.matchAll(/export type (\w+)/g)
  for (const match of typeExports) {
    if (configBody.includes(match[1]!)) {
      types.add(match[1]!)
    }
  }

  // Heuristic: PascalCase identifiers used as types in config
  for (const match of configBody.matchAll(/\b([A-Z][A-Za-z0-9]+)\b/g)) {
    const name = match[1]!
    if (['EntityConfigFactory', 'Promise', 'Date', 'Array', 'Object', 'Error', 'Map', 'Set', 'JSON'].includes(name)) {
      continue
    }
    if (domainHeader.includes(`class ${name}`) || domainHeader.includes(`enum ${name}`) || domainHeader.includes(`type ${name}`)) {
      values.add(name)
    }
  }

  return { types: [...types], values: [...values] }
}

function stripConfigImports(header: string): string {
  const lines = header.split('\n')
  const kept: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('import ') && (
      trimmed.includes('@edaya/school-service')
      || trimmed.includes('EntityConfigFactory')
      || (trimmed.includes('@edaya/authorization') && !usesAuthorizationInDomain(header, line))
    )) {
      continue
    }
    kept.push(line)
  }
  return `${kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}

function usesAuthorizationInDomain(header: string, importLine: string): boolean {
  const configMarker = header.indexOf('export const ')
  const domainOnly = configMarker === -1 ? header : header.slice(0, configMarker)
  const imported = [...importLine.matchAll(/\b([A-Z][A-Za-z0-9]+)\b/g)].map(m => m[1]!)
  const authOnly = ['Permission', 'permissionDefinitions', 'validateScopeIds', 'ActorMetadata']
  for (const symbol of imported) {
    if (authOnly.includes(symbol) && domainOnly.includes(symbol)) {
      return true
    }
    if (symbol === 'Permission' && domainOnly.includes('z.nativeEnum(Permission)')) {
      return true
    }
    if (symbol === 'permissionDefinitions' && domainOnly.includes('permissionDefinitions')) {
      return true
    }
    if (symbol === 'validateScopeIds' && domainOnly.includes('validateScopeIds')) {
      return true
    }
  }
  return false
}

function buildConfigFile(
  domainFile: string,
  configFile: string,
  domainHeader: string,
  configBody: string,
): string {
  const entityConfigPath = entityConfigImportPath(configFile)
  const carriedImports = collectDomainImports(domainHeader)
    .map(line => line.replace(/@edaya\/school-service/g, entityConfigPath))
  const { types, values } = collectEntitySymbols(domainHeader, configBody)

  const coreTypeImports = types.filter(t => !values.includes(t))
  const coreValueImports = [...values]

  const importBlocks: string[] = []

  if (coreTypeImports.length > 0 || coreValueImports.length > 0) {
    const typePart = coreTypeImports.length > 0 ? `type { ${coreTypeImports.join(', ')} }` : ''
    const valuePart = coreValueImports.length > 0 ? `{ ${coreValueImports.join(', ')} }` : ''
    const combined = [typePart, valuePart].filter(Boolean).join(', ')
    importBlocks.push(`import ${combined} from '@edaya/core'`)
  }

  importBlocks.push(...carriedImports)

  const relDomain = relative(join(ROOT, 'package/domain-core/src'), domainFile)
  return `${importBlocks.join('\n')}

// Extracted from domain/${relDomain} (PR3)
${rewriteRelativeImports(configBody.trimEnd(), domainFile, configFile)}
`
}

function extractFile(domainFile: string): boolean {
  const content = readFileSync(domainFile, 'utf8')
  const marker = content.search(/^export const \w+Config: EntityConfigFactory/m)
  if (marker === -1) {
    return false
  }

  const domainHeader = content.slice(0, marker)
  const configBody = content.slice(marker)

  const rel = relative(DOMAIN_ROOT, domainFile)
  const configFile = join(CONFIG_ROOT, rel)

  const newDomain = stripConfigImports(domainHeader)
  const newConfig = buildConfigFile(domainFile, configFile, domainHeader, configBody)

  if (DRY_RUN) {
    console.log(`Would extract: ${rel}`)
    return true
  }

  mkdirSync(dirname(configFile), { recursive: true })
  writeFileSync(domainFile, newDomain)
  writeFileSync(configFile, newConfig)
  console.log(`Extracted: ${rel}`)
  return true
}

const files = walkTsFiles(DOMAIN_ROOT)
let count = 0
for (const file of files) {
  if (extractFile(file)) {
    count += 1
  }
}

if (!DRY_RUN) {
  console.log(`\nExtracted ${count} entity configs to ${relative(ROOT, CONFIG_ROOT)}`)
}
