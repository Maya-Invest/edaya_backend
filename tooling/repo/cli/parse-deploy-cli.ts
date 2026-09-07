export type DeployApiTarget = 'staging' | 'production'

export type ParsedDeployCli
  = | { kind: 'help' }
    | { kind: 'api', target: DeployApiTarget }

const API_TARGETS = new Set<DeployApiTarget>(['staging', 'production'])

/** Wrangler `[env.*]` key — production deploy uses `prod`, not `production`. */
export function wranglerEnvNameForDeployTarget(target: DeployApiTarget): string {
  return target === 'production' ? 'prod' : target
}

export function parseDeployCliArgs(args: readonly string[]): ParsedDeployCli {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  const [app, target] = args
  if (app !== 'api') {
    throw new Error(`Only "api" deploy is supported. Got: ${app ?? '(missing)'}`)
  }
  if (!target || !API_TARGETS.has(target as DeployApiTarget)) {
    throw new Error(
      `Usage: bun repo deploy api <staging|production>. Got: ${target ?? '(missing)'}`,
    )
  }

  return { kind: 'api', target: target as DeployApiTarget }
}

export function deployCliUsage(): string {
  return [
    'Usage: bun repo deploy api <staging|production>',
    '',
    'Examples:',
    '  bun repo deploy api staging',
    '  bun repo deploy api production',
  ].join('\n')
}
