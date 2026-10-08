import type { readWorkerState } from './worker-vars.mjs'

export function formatWorkerStatus(worker: string, state: Awaited<ReturnType<typeof readWorkerState>>): string {
  const lines = [`Worker: ${worker}`]
  for (const version of state.deployments.deployments[0]?.versions ?? []) lines.push(`  version ${version.version_id}: ${version.percentage}%`)
  for (const key of ['PAUSE_API', 'PAUSE_SCHEDULER', 'PAUSE_JOBS']) {
    const binding = state.bindings.find(b => b.name === key)
    const value = binding?.type === 'plain_text' ? binding.text?.trim().toLowerCase() : undefined
    const status = !binding ? 'false (default)' : value === 'true' || value === '1' ? 'true' : value === 'false' || value === '0' ? 'false' : 'invalid binding/value'
    lines.push(`  ${key}: ${status}`)
  }
  return lines.join('\n')
}
