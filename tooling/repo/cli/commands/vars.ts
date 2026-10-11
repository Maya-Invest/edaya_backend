import process from 'node:process'
import { selectedVariables, updateWorkerVariables, workerTarget } from '../../operations/worker-vars.ts'
import { parseVarsCliArgs, varsCliUsage } from '../parse-vars-cli'

export async function dispatchVarsCommand(args: readonly string[]): Promise<number> {
  try {
    const parsed = parseVarsCliArgs(args)
    if (parsed.kind === 'help') {
      console.log(varsCliUsage())
      return 0
    }
    const worker = workerTarget(parsed.target)
    const result = await updateWorkerVariables({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
      worker,
      values: parsed.action === 'push' ? selectedVariables(parsed.target) : {},
      deletes: parsed.name ? [parsed.name] : [],
      replaceSecrets: parsed.replaceSecrets,
      dryRun: parsed.dryRun,
    })
    console.log(`${parsed.dryRun ? 'Preview' : result.applied ? 'Updated' : 'Unchanged'}: ${worker}`)
    for (const change of result.changes) console.log(`  ${change.action}: ${change.name}`)
    return 0
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'Variable update failed')
    return 1
  }
}
