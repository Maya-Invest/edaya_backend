import { commandUsage } from './catalog'

export type DeployApiTarget = 'staging' | 'production'

export type ParsedDeployCli
  = | { kind: 'help' }
    | { kind: 'api', target: DeployApiTarget, dryRun?: boolean }

const API_TARGETS = new Set<DeployApiTarget>(['staging', 'production'])

/** Wrangler `[env.*]` key — production deploy uses `prod`, not `production`. */
export function wranglerEnvNameForDeployTarget(target: DeployApiTarget): string {
  return target === 'production' ? 'prod' : target
}

export function parseDeployCliArgs(args: readonly string[]): ParsedDeployCli {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  const [target, ...flags] = args
  if (flags.some(flag => flag !== '--dry-run') || flags.length > 1)
    throw new Error('Unexpected deploy argument; only --dry-run is supported')
  if (!target || !API_TARGETS.has(target as DeployApiTarget)) {
    throw new Error(
      `Usage: bun repo deploy <staging|production>. Got: ${target ?? '(missing)'}`,
    )
  }

  return { kind: 'api', target: target as DeployApiTarget, ...(flags.length ? { dryRun: true } : {}) }
}

export function deployCliUsage(): string {
  return commandUsage('deploy')
}
