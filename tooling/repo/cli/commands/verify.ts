import { commandUsage } from '../catalog'
import { paths } from '../lib/paths'
import { runBunScript, runRepoCommand } from '../lib/spawn'
import { parseVerifyCliArgs } from '../parse-verify-cli'

interface VerifyStep {
  label: string
  run: () => Promise<number>
}

const HYGIENE_STEPS: VerifyStep[] = [
  { label: 'command documentation', run: () => runRepoCommand(['bun', 'tooling/repo/cli/command-docs.ts', '--check']) },
  { label: 'repo doctor', run: () => runBunScript(paths.doctor) },
  { label: 'repo check openapi', run: () => runBunScript(paths.openapiCheck) },
  { label: 'release contract', run: () => runRepoCommand(['python3', 'scripts/release-contract.py', '--role', 'backend']) },
  { label: 'repo check boundaries', run: () => runBunScript(paths.checkBoundaries) },
  { label: 'repo check test-naming', run: () => runBunScript(paths.checkTestNaming) },
]

export const CI_COMMANDS: readonly (readonly string[])[] = [
  ['bash', '.github/scripts/lint-workflows.sh'],
  ['bun', 'run', 'verify'],
  ['bun', '--filter', '@edaya/api', 'deploy:staging:dry-run'],
  ['bun', '--filter', '@edaya/api', 'deploy:production:dry-run'],
]
const CI_STEPS: VerifyStep[] = CI_COMMANDS.map(command => ({ label: command.join(' '), run: () => runRepoCommand(command) }))
const FULL_STEPS: VerifyStep[] = [
  ...CI_STEPS,
  { label: 'full backend integration', run: () => runRepoCommand(['bash', '.github/scripts/run-backend-integration.sh']) },
]

async function runSteps(steps: readonly VerifyStep[]): Promise<number> {
  for (const step of steps) {
    const exitCode = await step.run()
    if (exitCode !== 0) {
      console.error(`verify failed at: ${step.label}`)
      return exitCode
    }
  }
  return 0
}

export async function runVerify(options: { full?: boolean, ci?: boolean } = {}): Promise<number> {
  return runSteps(options.full ? FULL_STEPS : options.ci ? CI_STEPS : HYGIENE_STEPS)
}

export async function dispatchVerifyCommand(forwardArgs: readonly string[]): Promise<number> {
  let parsed
  try {
    parsed = parseVerifyCliArgs(forwardArgs)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error('')
    console.error(verifyCliUsage())
    return 1
  }

  if (parsed.kind === 'help') {
    console.log(verifyCliUsage())
    return 0
  }

  return runVerify({ full: parsed.full, ci: parsed.ci })
}

export function verifyCliUsage(): string {
  return commandUsage('verify')
}
