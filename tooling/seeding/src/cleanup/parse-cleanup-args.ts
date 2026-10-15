export type CleanupTarget = 'local' | 'staging'

export interface CleanupOptions {
  target: CleanupTarget
  yes: boolean
}

export const IDENTITY_AUTH_WIPE_HINT
  = 'Account authentication lives in apps/api/src/identity. Run `bun repo ops db wipe identity local --yes` or `bun repo ops db wipe identity staging --yes`.'

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
  return 'Use bun repo ops seed clean --help for public usage.'
}
