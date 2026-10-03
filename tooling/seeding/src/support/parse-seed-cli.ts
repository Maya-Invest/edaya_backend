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
    }
    | {
      kind: 'seed'
      target: SeedHttpTarget
      scope: HttpDevSeedScope
      clean: boolean
      repair: boolean
      skipProfilePhotos: boolean
      skipAttachments: boolean
      noProgress: boolean
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

function parseCleanInvocation(flagArgs: readonly string[]): SeedCliInvocation {
  if (flagArgs.includes('--auth')) {
    throw new Error(
      'Account authentication lives in apps/api/src/identity. Run `bun repo identity-wipe local --yes` or `bun repo identity-wipe staging --yes`.',
    )
  }

  return {
    kind: 'clean',
    target: flagArgs.includes('--staging') ? 'staging' : 'local',
    yes: flagArgs.includes('--yes') || flagArgs.includes('-y'),
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
    skipAttachments: flagArgs.includes('--skip-attachments'),
    noProgress: flagArgs.includes('--no-progress'),
  }
}

export function seedCliUsage(): string {
  return [
    'Usage: bun repo seed [clean] [--staging] [--scope <name>] [--clean] [--repair] [--skip-profile-photos] [--skip-attachments]',
    '',
    'Commands:',
    '  bun repo seed                 Full local demo seed',
    '  bun repo seed --staging       Full staging seed',
    '  bun repo seed clean           Wipe local school .data (stop bun repo dev first)',
    '  bun repo seed clean --staging Wipe staging school DB (requires STAGING_DATABASE_URL)',
    '  bun repo seed --scope doctor [--repair]',
    '  bun repo seed --scope <name>  Granular scope',
    '',
    'Options:',
    '  --staging                Target SEED_STAGING_API_URL (default: local SEED_API_URL)',
    '  --scope <name>           Granular scope (default: all)',
    `                           ${SEED_CLI_SCOPES.join(', ')}`,
    '  --clean                  Wipe before seeding (local or staging when --staging)',
    '  --repair                 With --scope doctor: run minimal repair chain',
    '  --skip-profile-photos    Skip profile photo uploads',
    '  --skip-attachments       Skip fixture attachment registration',
    '  --no-progress            Disable interactive progress bars',
    '  --yes, -y                With clean: skip confirmation prompt',
    '  -h, --help               Show this help',
    '',
    'Examples:',
    '  bun repo seed --scope auth:link',
    '  bun repo seed --staging --clean',
    '  bun repo seed clean --yes',
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
