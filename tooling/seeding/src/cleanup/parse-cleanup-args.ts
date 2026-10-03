export type CleanupTarget = 'local' | 'staging'

export interface CleanupOptions {
  target: CleanupTarget
  yes: boolean
}

export const IDENTITY_AUTH_WIPE_HINT
  = 'Account authentication lives in apps/api/src/identity. Run `bun repo identity-wipe local --yes` or `bun repo identity-wipe staging --yes`.'

export function parseCleanupArgs(argv: string[]): CleanupOptions {
  const args = argv.slice(2)
  const hasLocal = args.includes('--local')
  const hasStaging = args.includes('--staging')

  if (hasLocal && hasStaging) {
    throw new Error('Use either --local or --staging, not both.')
  }

  if (args.includes('--auth')) {
    throw new Error(IDENTITY_AUTH_WIPE_HINT)
  }

  return {
    target: hasStaging ? 'staging' : 'local',
    yes: args.includes('--yes') || args.includes('-y'),
  }
}

export function cleanupUsage(): string {
  return [
    'Usage: bun repo seed clean [--local|--staging] [--yes]',
    '',
    'Targets:',
    '  --local     Wipe repo-root .data/ (school PGlite). Default.',
    '  --staging   Wipe Neon staging school DB (requires STAGING_DATABASE_URL).',
    '',
    'Options:',
    '  --yes, -y   Skip confirmation prompt.',
    '',
    IDENTITY_AUTH_WIPE_HINT,
  ].join('\n')
}
