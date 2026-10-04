import { paths } from '../lib/paths'
import { runBunScript, runRepoCommand } from '../lib/spawn'
import { parseVerifyCliArgs } from '../parse-verify-cli'

interface VerifyStep {
  label: string
  run: () => Promise<number>
}

const HYGIENE_STEPS: VerifyStep[] = [
  { label: 'repo doctor', run: () => runBunScript(paths.doctor) },
  { label: 'repo check openapi', run: () => runBunScript(paths.openapiCheck) },
  { label: 'release contract', run: () => runRepoCommand(['python3', 'scripts/release-contract.py', '--role', 'backend']) },
  { label: 'repo check boundaries', run: () => runBunScript(paths.checkBoundaries) },
  { label: 'repo check test-naming', run: () => runBunScript(paths.checkTestNaming) },
]

/** Full local gate uses the same unit and complete integration entry points as CI. */
const FULL_STEPS: VerifyStep[] = [
  { label: 'unit verification', run: () => runRepoCommand(['bun', 'run', 'verify']) },
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

export async function runVerify(options: { full?: boolean } = {}): Promise<number> {
  return runSteps(options.full ? FULL_STEPS : HYGIENE_STEPS)
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

  return runVerify({ full: parsed.full })
}

export function verifyCliUsage(): string {
  return [
    'Usage: bun repo verify [--full]',
    '',
    'Repo hygiene checks (no Turbo):',
    ...HYGIENE_STEPS.map((step, index) => `  ${index + 1}. ${step.label}`),
    '',
    '  --full   Local PR CI gate: hygiene + quality + build + unit tests + integration',
    '           (all unit/tooling tests + service/HTTP, seed and native PostgreSQL; requires pg_config)',
    '',
    'Root `bun run verify` is hygiene + quality/build/unit only (no integration).',
  ].join('\n')
}
