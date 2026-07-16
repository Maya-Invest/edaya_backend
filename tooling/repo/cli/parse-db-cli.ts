export type DbMigrateTarget = 'local' | 'staging' | 'production'
export type DbMigrateSlice = 'full' | 'school' | 'auth'
export type DbBrowserTarget = 'school' | 'auth'

export type ParsedDbCli
  = | { kind: 'help' }
    | { kind: 'migrate', target: DbMigrateTarget, slice: DbMigrateSlice }
    | { kind: 'reset', target: Extract<DbMigrateTarget, 'staging' | 'production'>, yes: boolean }
    | { kind: 'flatten' }
    | { kind: 'generate', auth: boolean }
    | { kind: 'browser', target: DbBrowserTarget }

const MIGRATE_TARGETS = new Set<DbMigrateTarget>(['local', 'staging', 'production'])
const BROWSER_TARGETS = new Set<DbBrowserTarget>(['school', 'auth'])

function parseResetArgs(args: readonly string[]): ParsedDbCli {
  const [target, ...flags] = args
  if (target !== 'staging' && target !== 'production') {
    throw new Error(
      `Usage: bun repo db reset <staging|production> [--yes]. Got: ${target ?? '(missing)'}`,
    )
  }

  return {
    kind: 'reset',
    target,
    yes: flags.includes('--yes') || flags.includes('-y'),
  }
}

function parseMigrateArgs(args: readonly string[]): ParsedDbCli {
  const [target, ...flags] = args
  if (!target || !MIGRATE_TARGETS.has(target as DbMigrateTarget)) {
    throw new Error(
      `Usage: bun repo db migrate <local|staging|production> [--school|--auth]. Got: ${target ?? '(missing)'}`,
    )
  }

  const hasSchool = flags.includes('--school')
  const hasAuth = flags.includes('--auth')
  if (hasSchool && hasAuth) {
    throw new Error('Use either --school or --auth, not both.')
  }

  const slice: DbMigrateSlice = hasSchool ? 'school' : hasAuth ? 'auth' : 'full'
  return { kind: 'migrate', target: target as DbMigrateTarget, slice }
}

function parseGenerateArgs(args: readonly string[]): ParsedDbCli {
  if (args.length > 0 && !args.every(flag => flag === '--auth')) {
    throw new Error('Usage: bun repo db generate [--auth]')
  }
  return { kind: 'generate', auth: args.includes('--auth') }
}

function parseBrowserArgs(args: readonly string[]): ParsedDbCli {
  const [target] = args
  if (!target || !BROWSER_TARGETS.has(target as DbBrowserTarget)) {
    throw new Error(`Usage: bun repo db browser <school|auth>. Got: ${target ?? '(missing)'}`)
  }
  return { kind: 'browser', target: target as DbBrowserTarget }
}

export function parseDbCliArgs(args: readonly string[]): ParsedDbCli {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  const [subcommand, ...rest] = args
  switch (subcommand) {
    case 'migrate':
      return parseMigrateArgs(rest)
    case 'reset':
      return parseResetArgs(rest)
    case 'flatten':
      if (rest.length > 0) {
        throw new Error('Usage: bun repo db flatten')
      }
      return { kind: 'flatten' }
    case 'generate':
      return parseGenerateArgs(rest)
    case 'browser':
      return parseBrowserArgs(rest)
    default:
      throw new Error(
        `Unknown db subcommand: ${subcommand}. Valid: migrate, reset, flatten, generate, browser`,
      )
  }
}

export function dbCliUsage(): string {
  return [
    'Usage: bun repo db <subcommand>',
    '',
    'Subcommands:',
    '  migrate <local|staging|production> [--school|--auth]',
    '  reset <staging|production> [--yes]',
    '  flatten',
    '  generate [--auth]',
    '  browser <school|auth>',
    '',
    'Examples:',
    '  bun repo db migrate local',
    '  bun repo db migrate staging --auth',
    '  bun repo db reset staging --yes',
    '  bun repo db flatten',
    '  bun repo db generate',
    '  bun repo db generate --auth',
    '  bun repo db browser school',
  ].join('\n')
}

export function dbMigrateScriptName(target: DbMigrateTarget, slice: DbMigrateSlice): string {
  if (slice === 'full') {
    return `migrate:${target}`
  }
  return `migrate:${target}:${slice}`
}
