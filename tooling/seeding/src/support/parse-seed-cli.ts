import type { HttpDevSeedScope } from '../runtime/types'
import type { SeedHttpTarget } from './resolve-seed-env'

export const SEED_CLI_SCOPES = [
  'all',
  'school',
  'school-switching',
  'auth',
  'auth:link',
  'access',
  'profile-pictures',
  'service-account',
  's2s-clients',
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
      yes?: boolean
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
      'Account authentication lives in apps/api/src/identity. Run `bun repo ops db wipe identity local --yes` or `bun repo ops db wipe identity staging --yes`.',
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
    ...((flagArgs.includes('--yes') || flagArgs.includes('-y')) ? { yes: true } : {}),
    repair: flagArgs.includes('--repair'),
    skipProfilePhotos: flagArgs.includes('--skip-profile-photos'),
    skipAttachments: flagArgs.includes('--skip-attachments'),
    noProgress: flagArgs.includes('--no-progress'),
  }
}

/** Private worker parser; public options and help live in the repository command tree. */
export function seedCliUsage(): string {
  return 'Use bun repo ops seed --help, bun repo ops seed clean --help, or bun repo ops seed staging --help for public usage.'
}

export function parseSeedCliArgs(argv: readonly string[]): SeedCliInvocation {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { kind: 'help' }
  }

  const flags = argv.slice(2)
  const cleaning = flags[0] === 'clean'
  const allowed = new Set(cleaning ? ['--staging', '--yes', '-y', '--auth'] : ['--staging', '--scope', '--clean', '--yes', '-y', '--repair', '--skip-profile-photos', '--skip-attachments', '--no-progress'])
  const seen = new Set<string>()
  for (let i = cleaning ? 1 : 0; i < flags.length; i++) {
    const flag = flags[i]!
    if (!allowed.has(flag) || seen.has(flag === '-y' ? '--yes' : flag))
      throw new Error(`Unexpected or duplicate seed argument: ${flag}`)
    seen.add(flag === '-y' ? '--yes' : flag)
    if (flag === '--scope') {
      const value = flags[++i]
      if (!value || value.startsWith('-'))
        throw new Error('--scope requires a value')
    }
  }
  if (!cleaning && (seen.has('--yes') || seen.has('-y')) && !seen.has('--clean'))
    throw new Error('--yes requires clean or --clean')
  const positionalArgs = argv.slice(2)
  if (positionalArgs[0] === 'clean') {
    return parseCleanInvocation(positionalArgs.slice(1))
  }

  return parseSeedInvocation(positionalArgs)
}

export function seedInvocationTarget(invocation: Exclude<SeedCliInvocation, { kind: 'help' }>): SeedHttpTarget {
  return invocation.target
}
