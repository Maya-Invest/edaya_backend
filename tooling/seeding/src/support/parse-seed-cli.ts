import type { HttpDevSeedScope } from '../runtime/types'
import type { SeedHttpTarget } from './resolve-seed-env'

export const SEED_CLI_SCOPES = [
  'all',
  'school',
  'auth',
  'auth:link',
  'access',
  'profile-pictures',
  'service-account',
  'validate',
  'doctor',
] as const

export type SeedCliScope = (typeof SEED_CLI_SCOPES)[number]

export type SeedCliInvocation
  = | { kind: 'help' }
    | {
      kind: 'clean'
      target: SeedHttpTarget
      yes: boolean
      school: boolean
      auth: boolean
    }
    | {
      kind: 'seed'
      target: SeedHttpTarget
      scope: HttpDevSeedScope
      clean: boolean
      repair: boolean
      skipProfilePhotos: boolean
    }

function isSeedCliScope(value: string): value is SeedCliScope {
  return (SEED_CLI_SCOPES as readonly string[]).includes(value)
}

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  if (index < 0) {
    return undefined
  }
  return argv[index + 1]
}

function parseDbSliceFlags(flagArgs: readonly string[]): { school: boolean, auth: boolean } {
  const hasSchool = flagArgs.includes('--school')
  const hasAuth = flagArgs.includes('--auth')
  if (hasSchool && hasAuth) {
    throw new Error('Use either --school or --auth, not both.')
  }

  return {
    school: !hasAuth,
    auth: !hasSchool,
  }
}

function parseCleanInvocation(flagArgs: readonly string[]): SeedCliInvocation {
  const { school, auth } = parseDbSliceFlags(flagArgs)

  return {
    kind: 'clean',
    target: flagArgs.includes('--staging') ? 'staging' : 'local',
    yes: flagArgs.includes('--yes') || flagArgs.includes('-y'),
    school,
    auth,
  }
}

function parseSeedInvocation(flagArgs: readonly string[]): SeedCliInvocation {
  const scopeValue = readFlagValue(flagArgs, '--scope')
  let scope: HttpDevSeedScope = 'all'
  if (scopeValue) {
    if (!isSeedCliScope(scopeValue)) {
      throw new Error(
        `Unknown seed scope: ${scopeValue}. Valid scopes: ${SEED_CLI_SCOPES.join(', ')}`,
      )
    }
    scope = scopeValue
  }

  return {
    kind: 'seed',
    target: flagArgs.includes('--staging') ? 'staging' : 'local',
    scope,
    clean: flagArgs.includes('--clean'),
    repair: flagArgs.includes('--repair'),
    skipProfilePhotos: flagArgs.includes('--skip-profile-photos'),
  }
}

export function seedCliUsage(): string {
  return [
    'Usage: bun seed [clean] [--staging] [--scope <name>] [--clean] [--repair] [--skip-profile-photos]',
    '',
    'Commands:',
    '  bun seed                 Full local demo seed',
    '  bun seed --staging       Full staging seed',
    '  bun seed clean           Wipe local .data (stop bun dev first)',
    '  bun seed clean --staging Wipe staging DB (requires STAGING_DATABASE_URL)',
    '  bun seed --scope doctor [--repair]',
    '  bun seed --scope <name>  Granular scope',
    '',
    'Options:',
    '  --staging                Target SEED_STAGING_API_URL (default: local SEED_API_URL)',
    '  --scope <name>           Granular scope (default: all)',
    `                           ${SEED_CLI_SCOPES.join(', ')}`,
    '  --clean                  Wipe before seeding (local or staging when --staging)',
    '  --repair                 With --scope doctor: run minimal repair chain',
    '  --skip-profile-photos    Skip profile photo uploads',
    '  --yes, -y                With clean: skip confirmation prompt',
    '  --school                 With clean --staging: truncate school DB only',
    '  --auth                   With clean --staging: wipe auth only',
    '  -h, --help               Show this help',
    '',
    'Examples:',
    '  bun seed --scope auth:link',
    '  bun seed --staging --clean',
    '  bun seed clean --yes',
  ].join('\n')
}

export function parseSeedCliArgs(argv: readonly string[]): SeedCliInvocation {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { kind: 'help' }
  }

  const positionalArgs = argv.slice(2)
  if (positionalArgs[0] === 'clean') {
    return parseCleanInvocation(positionalArgs.slice(1))
  }

  return parseSeedInvocation(positionalArgs)
}

export function seedInvocationTarget(invocation: Exclude<SeedCliInvocation, { kind: 'help' }>): SeedHttpTarget {
  return invocation.target
}
