import process from 'node:process'

const LOCAL_DATABASE_URLS = new Set(['pglite', 'memory'])

export function isLocalAuthDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl?.trim()) {
    return true
  }

  const trimmed = databaseUrl.trim()
  return LOCAL_DATABASE_URLS.has(trimmed) || trimmed.startsWith('pglite:')
}

/** Block obvious production Neon URLs unless the operator explicitly opts in. */
export function assertStagingIdentityDatabaseUrl(databaseUrl: string): void {
  const trimmed = databaseUrl.trim()
  if (!trimmed) {
    throw new Error('STAGING_AUTH_DATABASE_URL (or AUTH_DATABASE_URL) is required for staging identity wipe.')
  }

  if (isLocalAuthDatabaseUrl(trimmed)) {
    throw new Error('Refusing to wipe a local/ephemeral AUTH_DATABASE_URL. Use `bun repo identity-wipe local` for `.data/identity`.')
  }

  const allowDestructive = process.env['SEED_ALLOW_DESTRUCTIVE']?.trim().toLowerCase()
  if (allowDestructive === 'true' || allowDestructive === '1' || allowDestructive === 'yes') {
    return
  }

  let hostname = ''
  try {
    hostname = new URL(trimmed.replace(/^postgres(ql)?:\/\//, 'postgres://')).hostname.toLowerCase()
  }
  catch {
    throw new Error('STAGING_AUTH_DATABASE_URL is not a valid Postgres connection string.')
  }

  const looksLikeStaging = hostname.includes('staging')
    || hostname.includes('-staging')
    || trimmed.includes('/staging')
    || trimmed.includes('branch=staging')

  if (!looksLikeStaging) {
    throw new Error(
      'Refusing to wipe identity data: STAGING_AUTH_DATABASE_URL does not look like a staging branch. '
      + 'Set SEED_ALLOW_DESTRUCTIVE=true to override.',
    )
  }
}
