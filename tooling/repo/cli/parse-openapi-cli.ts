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

  return { kind: 'run', action: action as OpenapiAction, forwardArgs }
}

export function openapiCliUsage(): string {
  return [
    'Usage: bun repo openapi <export|generate>',
    '',
    'Actions:',
    '  export     Export OpenAPI fixture from local API types',
    '  generate   Regenerate client artifacts from fixture',
    '',
    'Options are forwarded to the underlying script (e.g. --output, --openapi).',
  ].join('\n')
}
