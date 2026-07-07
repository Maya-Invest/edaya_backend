import { paths } from '../lib/paths'
import { runBunScript } from '../lib/spawn'

interface VerifyStep {
  label: string
  run: () => Promise<number>
}

const VERIFY_STEPS: VerifyStep[] = [
  { label: 'repo doctor', run: () => runBunScript(paths.doctor) },
  { label: 'repo check openapi', run: () => runBunScript(paths.openapiCheck) },
  { label: 'repo check boundaries', run: () => runBunScript(paths.checkBoundaries) },
  { label: 'repo check test-naming', run: () => runBunScript(paths.checkTestNaming) },
]

export async function runVerify(): Promise<number> {
  for (const step of VERIFY_STEPS) {
    const exitCode = await step.run()
    if (exitCode !== 0) {
      console.error(`verify failed at: ${step.label}`)
      return exitCode
    }
  }
  return 0
}

export function verifyCliUsage(): string {
  return [
    'Usage: bun repo verify',
    '',
    'Repo hygiene checks (no Turbo — use root `bun run lint|check|test|build|quality` or `bun run verify`):',
    ...VERIFY_STEPS.map((step, index) => `  ${index + 1}. ${step.label}`),
  ].join('\n')
}
