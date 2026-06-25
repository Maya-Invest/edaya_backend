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

  const schoolOnly = args.includes('--school-only')
  const authOnly = args.includes('--auth-only')
  if (schoolOnly && authOnly) {
    throw new Error('Use either --school-only or --auth-only, not both.')
  }

  return {
    target: hasStaging ? 'staging' : 'local',
    yes: args.includes('--yes') || args.includes('-y'),
    school: !authOnly,
    auth: !schoolOnly,
  }
}

export function cleanupUsage(): string {
  return [
    'Usage: bun seed:clean [--local|--staging] [--yes] [--school-only|--auth-only]',
    '',
    'Targets:',
    '  --local     Wipe repo-root .data/ (PGlite school DB + auth.sqlite). Default.',
    '  --staging   Wipe Neon staging school DB + Better Auth D1 (requires STAGING_DATABASE_URL).',
    '',
    'Options:',
    '  --yes, -y   Skip confirmation prompt.',
    '  --school-only  Truncate Neon public tables only (staging).',
    '  --auth-only    Delete Better Auth users/sessions only (staging).',
  ].join('\n')
}
