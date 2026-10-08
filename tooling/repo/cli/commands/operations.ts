import type { OperationCommand } from '../parse-operations-cli'
import process from 'node:process'
import { operateSecrets } from '../../operations/secrets'
import { formatWorkerStatus } from '../../operations/status'
import { readWorkerState, updateWorkerVariables, workerTarget } from '../../operations/worker-vars.mjs'
import { paths } from '../lib/paths'
import { parseOperationsCli, pauseValues } from '../parse-operations-cli'

export async function dispatchOperations(command: OperationCommand, args: readonly string[]): Promise<number> {
  try {
    const parsed = parseOperationsCli(command, args)
    const worker = workerTarget(parsed.target)
    const credentials = { worker, accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN }
    if (command === 'secrets') {
      const result = await operateSecrets(parsed, credentials, async (argv, input) => {
        const child = Bun.spawn(['bun', '--no-env-file', 'wrangler', ...argv], { cwd: paths.apiRoot, stdin: 'pipe', stdout: 'inherit', stderr: 'inherit', env: process.env })
        child.stdin.write(input)
        child.stdin.end()
        return child.exited
      })
      console.log(`${parsed.dryRun ? 'Local preview' : result.applied ? 'Updated' : 'Secrets'}: ${worker}`)
      for (const name of result.names) console.log(`  ${name}`)
    }
    else if (command === 'status') {
      const state = await readWorkerState(credentials)
      console.log(formatWorkerStatus(worker, state))
    }
    else {
      const result = await updateWorkerVariables({ ...credentials, values: pauseValues(parsed.action, command === 'pause'), dryRun: parsed.dryRun })
      console.log(`${parsed.dryRun ? 'Preview' : result.applied ? 'Updated' : 'Unchanged'}: ${worker}`)
      for (const change of result.changes) console.log(`  ${change.action}: ${change.name}`)
    }
    return 0
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'Operation failed')
    return 1
  }
}
