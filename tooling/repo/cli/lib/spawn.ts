import { redact, run } from '../../ops/runtime'
import { repoRoot } from './paths'

export async function runBunScript(scriptPath: string, forwardArgs: readonly string[] = []): Promise<number> {
  return runRepoCommand(['bun', '--no-env-file', scriptPath, ...forwardArgs])
}

export async function runRepoCommand(
  command: readonly string[],
  options?: { cwd?: string },
): Promise<number> {
  try {
    await run(command, { cwd: options?.cwd ?? repoRoot, inheritInput: true, timeout: command.some(arg => arg.endsWith('db-browser.ts')) ? 0 : 30 * 60000 })
    return 0
  }
  catch (error) {
    console.error(redact(error instanceof Error ? error.message : 'Operation failed'))
    return 1
  }
}
