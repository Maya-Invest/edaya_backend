import { resolve } from 'node:path'
import { loadConfiguration } from '../../../../../apps/api/configuration/index.mjs'

export function resolveIdentityMigrationTarget(args: readonly string[], source: Record<string, string | undefined>, root: string): { databaseUrl: string, label: string } {
  if (args.length > 1 || (args.length && !['local', 'staging', 'production'].includes(args[0]!)))
    throw new Error('Usage: bun repo db migrate identity <local|staging|production>')
  const target = args[0]
  let databaseUrl: string | undefined
  if (!target) {
    const candidates = [...new Set(['AUTH_DATABASE_URL', 'STAGING_AUTH_DATABASE_URL', 'PRODUCTION_AUTH_DATABASE_URL'].map(key => source[key]?.trim()).filter(Boolean))]
    if (candidates.length !== 1)
      throw new Error('Legacy identity-migrate requires exactly one database URL. Use db migrate identity with an explicit target.')
    databaseUrl = candidates[0]
  }
  else if (target === 'local') {
    databaseUrl = loadConfiguration('local', { root: resolve(root, 'apps/api'), source })['AUTH_DATABASE_URL']
  }
  else {
    databaseUrl = source[target === 'staging' ? 'STAGING_AUTH_DATABASE_URL' : 'PRODUCTION_AUTH_DATABASE_URL']
  }
  if (!databaseUrl?.trim())
    throw new Error(`Missing identity database URL for ${target ?? 'legacy target'}`)
  if (databaseUrl.startsWith('pglite:')) {
    const path = databaseUrl.slice('pglite:'.length).trim()
    if (!path || path === 'memory' || target === 'staging' || target === 'production')
      throw new Error('Identity migrations require a persisted local PGlite path or remote PostgreSQL URL')
    databaseUrl = `pglite:${resolve(root, path)}`
  }
  else {
    let url: URL
    try {
      url = new URL(databaseUrl)
    }
    catch { throw new Error('Invalid identity database URL') }
    if (!['postgres:', 'postgresql:'].includes(url.protocol))
      throw new Error('Expected a PostgreSQL identity database URL')
  }
  return { databaseUrl, label: target ?? 'legacy explicit URL' }
}
