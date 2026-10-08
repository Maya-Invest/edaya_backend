import { commandUsage } from './catalog'

export type OpenapiAction = 'export' | 'generate'

export type ParsedOpenapiCli
  = | { kind: 'help' }
    | { kind: 'run', action: OpenapiAction, forwardArgs: string[] }

const ACTIONS = new Set<OpenapiAction>(['export', 'generate'])

export function parseOpenapiCliArgs(args: readonly string[]): ParsedOpenapiCli {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  const [action, ...forwardArgs] = args
  if (!action || !ACTIONS.has(action as OpenapiAction)) {
    throw new Error(
      `Unknown openapi action: ${action ?? '(missing)'}. Valid: ${[...ACTIONS].join(', ')}`,
    )
  }

  if (action === 'generate' && forwardArgs.length)
    throw new Error('openapi generate accepts no options; use codegen generate for custom inputs/outputs')
  if (action === 'export' && forwardArgs.length && (forwardArgs.length !== 2 || forwardArgs[0] !== '--output' || !forwardArgs[1] || forwardArgs[1].startsWith('-')))
    throw new Error('Usage: bun repo openapi export [--output PATH]')
  return { kind: 'run', action: action as OpenapiAction, forwardArgs }
}

export function openapiCliUsage(): string {
  return commandUsage('openapi')
}
