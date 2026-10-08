import { commandUsage } from './catalog'

export type DbMigrateTarget = 'local' | 'staging' | 'production'
export type DbMigrateSlice = 'school'
export type DbBrowserTarget = 'school'
export type ParsedDbCli
  = | { kind: 'help' }
    | { kind: 'migrate', target: DbMigrateTarget, slice: 'school' }
    | { kind: 'identity-migrate', target: DbMigrateTarget }
    | { kind: 'identity-wipe', target: 'local' | 'staging', yes: boolean }
    | { kind: 'reset', target: 'staging' | 'production', yes: boolean }
    | { kind: 'flatten', yes?: boolean }
    | { kind: 'generate' }
    | { kind: 'browser', target: 'school' }
const targets = new Set(['local', 'staging', 'production'])
function yesFlag(flags: readonly string[]): boolean {
  if (flags.length > 1 || flags.some(flag => flag !== '--yes' && flag !== '-y'))
    throw new Error('Only --yes is supported for this operation')
  return flags.length > 0
}
export function parseDbCliArgs(args: readonly string[]): ParsedDbCli {
  if (!args.length || args.includes('--help') || args.includes('-h'))
    return { kind: 'help' }
  const [action, ...rest] = args
  if (action === 'migrate') {
    const explicit = rest[0] === 'school' || rest[0] === 'identity'
    const database = explicit ? rest.shift() : 'school'
    const target = rest.shift()
    if (!target || !targets.has(target) || rest.length)
      throw new Error('Usage: bun repo db migrate <school|identity> <local|staging|production>')
    return database === 'identity' ? { kind: 'identity-migrate', target: target as DbMigrateTarget } : { kind: 'migrate', target: target as DbMigrateTarget, slice: 'school' }
  }
  if (action === 'reset') {
    if (rest[0] === 'school')
      rest.shift()
    const target = rest.shift()
    if (target !== 'staging' && target !== 'production')
      throw new Error('Usage: bun repo db reset school <staging|production> [--yes]')
    return { kind: 'reset', target, yes: yesFlag(rest) }
  }
  if (action === 'wipe') {
    const [database, target, ...flags] = rest
    if (database !== 'identity' || (target !== 'local' && target !== 'staging'))
      throw new Error('Usage: bun repo db wipe identity <local|staging> [--yes]')
    return { kind: 'identity-wipe', target, yes: yesFlag(flags) }
  }
  if (action === 'flatten') {
    const yes = yesFlag(rest)
    return { kind: 'flatten', ...(yes ? { yes } : {}) }
  }
  if (action === 'generate' && !rest.length)
    return { kind: 'generate' }
  if (action === 'browser' && rest.length === 1 && rest[0] === 'school')
    return { kind: 'browser', target: 'school' }
  throw new Error(commandUsage('db'))
}
export function dbCliUsage(): string {
  return commandUsage('db')
}
export function dbMigrateScriptName(target: DbMigrateTarget, slice: DbMigrateSlice): string {
  return `migrate:${target}:${slice}`
}
