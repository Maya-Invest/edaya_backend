export type NovuGroup = 'bootstrap' | 'cleanup'
export type NovuBootstrapAction = 'plan' | 'apply' | 'validate'
export type NovuCleanupAction = 'plan' | 'apply'

export type ParsedNovuCli
  = | { kind: 'help' }
    | { kind: 'bootstrap', action: NovuBootstrapAction }
    | { kind: 'cleanup', action: NovuCleanupAction, forwardArgs: string[] }

const BOOTSTRAP_ACTIONS = new Set<NovuBootstrapAction>(['plan', 'apply', 'validate'])
const CLEANUP_ACTIONS = new Set<NovuCleanupAction>(['plan', 'apply'])

export function parseNovuCliArgs(args: readonly string[]): ParsedNovuCli {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  const [group, actionOrFlag, ...rest] = args

  if (group === 'bootstrap') {
    const action = (actionOrFlag && BOOTSTRAP_ACTIONS.has(actionOrFlag as NovuBootstrapAction)
      ? actionOrFlag
      : 'plan') as NovuBootstrapAction
    return { kind: 'bootstrap', action }
  }

  if (group === 'cleanup') {
    const action = (actionOrFlag && CLEANUP_ACTIONS.has(actionOrFlag as NovuCleanupAction)
      ? actionOrFlag
      : 'plan') as NovuCleanupAction
    const forwardArgs = actionOrFlag && CLEANUP_ACTIONS.has(actionOrFlag as NovuCleanupAction)
      ? rest
      : actionOrFlag
        ? [actionOrFlag, ...rest]
        : rest
    return { kind: 'cleanup', action, forwardArgs }
  }

  throw new Error(
    `Unknown novu group: ${group ?? '(missing)'}. Valid: bootstrap, cleanup`,
  )
}

export function novuCliUsage(): string {
  return [
    'Usage: bun repo novu <group> [action] [options]',
    '',
    'Groups:',
    '  bootstrap [plan|apply|validate]   Novu workflow bootstrap (default: plan)',
    '  cleanup [plan|apply] [flags]      Subscriber cleanup (default: plan)',
    '',
    'Examples:',
    '  bun repo novu bootstrap',
    '  bun repo novu bootstrap apply',
    '  bun repo novu cleanup apply --yes',
  ].join('\n')
}
