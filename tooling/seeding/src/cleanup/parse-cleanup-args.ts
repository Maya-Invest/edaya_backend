export type CleanupTarget = 'local' | 'staging'

export interface CleanupOptions {
  target: CleanupTarget
  yes: boolean
  school: boolean
  auth: boolean
}

export function parseCleanupArgs(argv: string[]): CleanupOptions {
  const args = argv.slice(2)
  const hasLocal = args.includes('--local')
  const hasStaging = args.includes('--staging')

  if (hasLocal && hasStaging) {
    throw new Error('Use either --local or --staging, not both.')
  }

  const hasSchool = args.includes('--school')
  const hasAuth = args.includes('--auth')
  if (hasSchool && hasAuth) {
    throw new Error('Use either --school or --auth, not both.')
  }

  return {
    target: hasStaging ? 'staging' : 'local',
    yes: args.includes('--yes') || args.includes('-y'),
    school: !hasAuth,
    auth: !hasSchool,
  }
}

export function cleanupUsage(): string {
  return [
    'Usage: bun repo seed clean [--local|--staging] [--yes] [--school|--auth]',
    '',
    'Targets:',
    '  --local     Wipe repo-root .data/ (PGlite school DB + auth). Default.',
    '  --staging   Wipe Neon staging school DB + auth (requires STAGING_DATABASE_URL).',
    '',
    'Options:',
    '  --yes, -y   Skip confirmation prompt.',
    '  --school    Truncate Neon public tables only (staging).',
    '  --auth      Delete Better Auth users/sessions only (staging).',
  ].join('\n')
}
