/** Validation may reset only a release-owned disposable loopback rehearsal. */
export function assertStagingMutationAllowed(value: string, env: Record<string, string | undefined>) {
  if (env['VALIDATE_ONLY'] !== 'true')
    return
  let local = false
  try {
    local = new URL(value).hostname === '127.0.0.1'
  }
  catch { /* Invalid targets must never authorize a write. */ }
  if (!local || env['EDAYA_DISPOSABLE_POSTGRES'] !== 'true')
    throw new Error('VALIDATE_ONLY forbids live database migration and reset')
}

/** Expected non-secret targets are supplied by the release configuration or local rehearsal. */
export function stagingDatabaseTarget(kind: 'school' | 'identity', env: Record<string, string | undefined>): URL {
  const value = env[kind === 'school' ? 'STAGING_DATABASE_URL' : 'STAGING_AUTH_DATABASE_URL'] ?? ''
  let target: URL
  try {
    target = new URL(value)
  }
  catch {
    throw new Error('Missing or invalid staging database URL')
  }
  const host = env['STAGING_DATABASE_HOST']
  const database = env[kind === 'school' ? 'STAGING_SCHOOL_DATABASE' : 'STAGING_IDENTITY_DATABASE']
  const role = env['STAGING_IDENTITY_ROLE']
  const disposable = env['EDAYA_DISPOSABLE_POSTGRES'] === 'true' && target.hostname === '127.0.0.1'
  if (env['RELEASE_TARGET'] !== 'staging' || !['true', 'false'].includes(env['RESET_DATA'] ?? '')
    || !host || !database || !role || target.hostname !== host || host.includes('-pooler')
    || !['postgres:', 'postgresql:'].includes(target.protocol)
    || decodeURIComponent(target.pathname.slice(1)) !== database
    || (kind === 'identity' && decodeURIComponent(target.username) !== role)
    || (kind === 'school' && decodeURIComponent(target.username) === role)
    || !env['STAGING_SCHOOL_DATABASE'] || !env['STAGING_IDENTITY_DATABASE']
    || env['STAGING_SCHOOL_DATABASE'] === env['STAGING_IDENTITY_DATABASE']
    || (!disposable && (!target.password || !['require', 'verify-full'].includes(target.searchParams.get('sslmode') ?? '')))) {
    throw new Error('Database does not match the configured staging target, dedicated role, or TLS policy')
  }
  return target
}
