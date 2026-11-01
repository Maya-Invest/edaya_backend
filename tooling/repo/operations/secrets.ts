import type { ParsedOperation } from '../cli/parse-operations-cli'
import type { WorkerCredentials } from './worker-vars.ts'
import { resolve } from 'node:path'
import { apiRoot, readSecrets } from '../../../apps/api/configuration/index.ts'
import { readWorkerState } from './worker-vars.ts'

export async function operateSecrets(
  parsed: ParsedOperation,
  credentials: WorkerCredentials,
  runWrangler: (args: string[], input: string) => Promise<number>,
  root = apiRoot,
): Promise<{ names: string[], applied: boolean }> {
  let payload: Record<string, string | null> = {}
  if (parsed.action === 'push') {
    payload = readSecrets(resolve(root, parsed.target === 'production' ? 'secrets.prod.json' : 'secrets.staging.json'))
    const localOnly = ['DATABASE_URL', 'AUTH_DATABASE_URL', 'LOCAL_FILES_SECRET', 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE', 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH']
    if (Object.keys(payload).some(key => localOnly.includes(key)))
      throw new Error('Local database/file credentials cannot be uploaded to the Worker')
    if (!Object.keys(payload).length)
      throw new Error('Secret payload is empty')
  }
  if (parsed.action === 'delete')
    payload = { [parsed.name!]: null }
  // Preview validates local input only and never reads or writes remote secrets.
  if (parsed.dryRun)
    return { names: Object.keys(payload), applied: false }
  const state = await readWorkerState(credentials)
  if (parsed.action === 'list')
    return { names: state.bindings.filter(b => b.type === 'secret_text').map(b => b.name).sort(), applied: false }
  const active = state.deployments.deployments[0]?.versions
  if (active?.length !== 1 || active[0]!.percentage !== 100 || state.versions.items[0]?.id !== active[0]!.version_id)
    throw new Error('Resolve pending or multi-version deployments before changing secrets')
  for (const name of Object.keys(payload)) {
    const existing = state.bindings.find(b => b.name === name)
    if (existing && existing.type !== 'secret_text')
      throw new Error(`${name}: existing binding is not a secret`)
  }
  if (parsed.action === 'delete' && !state.bindings.some(b => b.name === parsed.name))
    return { names: [], applied: false }
  // Wrangler appends `--env` to `--name` (`edaya-api-staging` + `staging`). The name is already environment-specific.
  const args = ['secret', 'bulk', '--name', credentials.worker]
  const result = await runWrangler(args, JSON.stringify(payload))
  if (result !== 0)
    throw new Error('Wrangler secret update failed')
  const after = await readWorkerState(credentials)
  for (const [name, value] of Object.entries(payload)) {
    const binding = after.bindings.find(b => b.name === name)
    if (value === null ? !!binding : binding?.type !== 'secret_text')
      throw new Error(`${name}: secret binding verification failed`)
  }
  return { names: Object.keys(payload), applied: true }
}
