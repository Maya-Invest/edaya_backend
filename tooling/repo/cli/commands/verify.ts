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
  { label: 'repo check boundaries', run: () => runBunScript(paths.checkBoundaries) },
  { label: 'repo check test-naming', run: () => runBunScript(paths.checkTestNaming) },
]

/** Matches root `bun run verify` Turbo portion (after hygiene). */
const QUALITY_STEPS: VerifyStep[] = [
  { label: 'turbo quality', run: () => runRepoCommand(['bun', 'run', 'quality']) },
  { label: 'turbo build', run: () => runRepoCommand(['bun', 'run', 'build']) },
  { label: 'turbo test', run: () => runRepoCommand(['bun', 'x', 'turbo', 'run', 'test', '--', '--dots']) },
]

/** PR blocking integration job (`_integration.yml`). */
const FULL_STEPS: VerifyStep[] = [
  { label: 'test:integration', run: () => runRepoCommand(['bun', 'run', 'test:integration']) },
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
  const hygiene = await runSteps(HYGIENE_STEPS)
  if (hygiene !== 0) {
    return hygiene
  }

  if (!options.full) {
    return 0
  }

  const quality = await runSteps(QUALITY_STEPS)
  if (quality !== 0) {
    return quality
  }

  return runSteps(FULL_STEPS)
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
    '           (matches `_verify.yml` + `_integration.yml`; omits informational coverage)',
    '',
    'Root `bun run verify` is hygiene + quality/build/unit only (no integration).',
  ].join('\n')
}
