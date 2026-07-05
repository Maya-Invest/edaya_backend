import { paths } from '../lib/paths'
import { runBunScript, runRepoCommand } from '../lib/spawn'

interface VerifyStep {
  label: string
  run: () => Promise<number>
}

const VERIFY_STEPS: VerifyStep[] = [
  { label: 'repo doctor', run: () => runBunScript(paths.doctor) },
  { label: 'turbo lint', run: () => runRepoCommand(['bunx', 'turbo', 'run', 'lint']) },
  { label: 'turbo check', run: () => runRepoCommand(['bunx', 'turbo', 'run', 'check']) },
  { label: 'turbo build', run: () => runRepoCommand(['bunx', 'turbo', 'run', 'build']) },
  { label: 'repo check openapi', run: () => runBunScript(paths.openapiCheck) },
  { label: 'repo check boundaries', run: () => runBunScript(paths.checkBoundaries) },
  { label: '@edaya/repo test', run: () => runRepoCommand(['bun', '--filter', '@edaya/repo', 'test']) },
  {
    label: 'turbo test',
    run: () => runRepoCommand(['bunx', 'turbo', 'run', 'test', '--', '--dots']),
  },
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
    'Pre-PR pipeline:',
    ...VERIFY_STEPS.map((step, index) => `  ${index + 1}. ${step.label}`),
  ].join('\n')
}
