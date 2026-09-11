export type DbMigrateTarget = 'local' | 'staging' | 'production'
export type DbMigrateSlice = 'school'
export type DbBrowserTarget = 'school'

export type ParsedDbCli
  = | { kind: 'help' }
    | { kind: 'migrate', target: DbMigrateTarget, slice: DbMigrateSlice }
    | { kind: 'reset', target: Extract<DbMigrateTarget, 'staging' | 'production'>, yes: boolean }
    | { kind: 'flatten' }
    | { kind: 'generate' }
    | { kind: 'browser', target: DbBrowserTarget }

const MIGRATE_TARGETS = new Set<DbMigrateTarget>(['local', 'staging', 'production'])
const BROWSER_TARGETS = new Set<DbBrowserTarget>(['school'])

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
      `Usage: bun repo db migrate <local|staging|production>. Got: ${target ?? '(missing)'}`,
    )
  }

  if (flags.length > 0) {
    throw new Error('School migrations do not accept auth slices.')
  }

  return { kind: 'migrate', target: target as DbMigrateTarget, slice: 'school' }
}

function parseGenerateArgs(args: readonly string[]): ParsedDbCli {
  if (args.length > 0) {
    throw new Error('Usage: bun repo db generate')
  }
  return { kind: 'generate' }
}

function parseBrowserArgs(args: readonly string[]): ParsedDbCli {
  const [target] = args
  if (!target || !BROWSER_TARGETS.has(target as DbBrowserTarget)) {
    throw new Error(`Usage: bun repo db browser school. Got: ${target ?? '(missing)'}`)
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
    '  migrate <local|staging|production>',
    '  reset <staging|production> [--yes]',
    '  flatten',
    '  generate',
    '  browser school',
    '',
    'Examples:',
    '  bun repo db migrate local',
    '  bun repo db reset staging --yes',
    '  bun repo db flatten',
    '  bun repo db generate',
    '  bun repo db browser school',
  ].join('\n')
}

export function dbMigrateScriptName(target: DbMigrateTarget, slice: DbMigrateSlice): string {
  return `migrate:${target}:${slice}`
}
